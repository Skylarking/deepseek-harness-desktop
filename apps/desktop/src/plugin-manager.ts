/** Profile plugin management through the same DSH CLI used by the desktop runtime. */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { lstat, readFile, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { delimiter, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { parseDocument } from 'yaml'
import type { DesktopPlugin } from './contracts.ts'
import { dshNodeArgs } from './dsh-process.ts'

interface ProfileManifest {
  dependencies?: Record<string, string>
  dsh?: {
    bundle?: { patch?: unknown }
    profile?: { bundles?: unknown }
    desktop?: {
      overlay?: unknown
      defaultPlugins?: unknown
      managedSupportPackages?: unknown
      support?: unknown
      supportPackages?: unknown
    }
    settings?: { namespaces?: unknown }
  }
}

type DesktopPackageKind = DesktopPlugin['kind']

/** Remove obsolete Desktop-owned bundle links without touching externally installed replacements. */
export async function removeRetiredDesktopDefaults(profileDir: string, runtimeEntry: string): Promise<string[]> {
  const manifestPath = join(profileDir, 'package.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as ProfileManifest
  const recorded = Array.isArray(manifest.dsh?.desktop?.defaultPlugins)
    ? manifest.dsh.desktop.defaultPlugins.filter((value): value is string => typeof value === 'string')
    : []
  if (recorded.length === 0) return []
  const dependencies = manifest.dependencies ?? {}
  const runtimeRoot = dirname(dirname(runtimeEntry))
  const removed: string[] = []
  for (const name of recorded) {
    const spec = dependencies[name]
    const source = spec === undefined ? undefined : localPluginPath(spec, profileDir)
    if (source === undefined) continue
    const sourceRelative = relative(runtimeRoot, source)
    if (sourceRelative !== '' && (isAbsolute(sourceRelative) || sourceRelative === '..' || sourceRelative.startsWith('../'))) continue
    Reflect.deleteProperty(dependencies, name)
    removed.push(name)
  }
  const bundles = Array.isArray(manifest.dsh?.profile?.bundles)
    ? manifest.dsh.profile.bundles.filter((value): value is string => typeof value === 'string')
    : []
  manifest.dependencies = dependencies
  manifest.dsh ??= {}
  manifest.dsh.profile = { ...manifest.dsh.profile, bundles: bundles.filter(name => !removed.includes(name)) }
  if (manifest.dsh.desktop !== undefined) delete manifest.dsh.desktop.defaultPlugins
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  for (const name of removed) await cleanupProfilePluginLink(profileDir, name)
  return removed
}

function settingsNamespaces(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const namespaces = value.filter((entry): entry is string => (
    typeof entry === 'string' && /^[a-z0-9][a-z0-9._-]*$/iu.test(entry)
  ))
  return namespaces.length === 0 ? undefined : [...new Set(namespaces)]
}

function packageName(value: string): boolean {
  return /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/iu.test(value)
}

function managedSupportPackages(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string' && packageName(entry))
}

function supportPackages(value: unknown, packageDir: string): Record<string, string> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const resolved: Record<string, string> = {}
  for (const [name, spec] of Object.entries(value)) {
    if (!packageName(name) || typeof spec !== 'string' || spec.length === 0) {
      throw new Error(`Invalid Desktop support package declaration in ${packageDir}`)
    }
    resolved[name] = resolve(packageDir, spec)
  }
  return Object.keys(resolved).length === 0 ? undefined : resolved
}

interface DesktopOverlayManifest {
  entry?: unknown
  width?: unknown
  height?: unknown
  expandedWidth?: unknown
  expandedHeight?: unknown
  x?: unknown
  y?: unknown
}

function desktopOverlay(value: unknown): DesktopPlugin['desktopOverlay'] {
  if (typeof value !== 'object' || value === null) return undefined
  const overlay = value as DesktopOverlayManifest
  if (typeof overlay.entry !== 'string' || overlay.entry.length === 0) return undefined
  if (!Number.isInteger(overlay.width) || !Number.isInteger(overlay.height)) return undefined
  if ((overlay.width as number) < 64 || (overlay.height as number) < 64) return undefined
  return {
    entry: overlay.entry,
    width: overlay.width as number,
    height: overlay.height as number,
    ...(Number.isInteger(overlay.expandedWidth) && (overlay.expandedWidth as number) >= (overlay.width as number)
      ? { expandedWidth: overlay.expandedWidth as number }
      : {}),
    ...(Number.isInteger(overlay.expandedHeight) && (overlay.expandedHeight as number) >= (overlay.height as number)
      ? { expandedHeight: overlay.expandedHeight as number }
      : {}),
    ...(Number.isInteger(overlay.x) ? { x: overlay.x as number } : {}),
    ...(Number.isInteger(overlay.y) ? { y: overlay.y as number } : {}),
  }
}

/** Resolve the shared DSH profile directory without copying credentials or settings. */
export function resolveWebProfileDir(environment: NodeJS.ProcessEnv = process.env): string {
  const dshHome = environment.DSH_HOME === undefined || environment.DSH_HOME === ''
    ? join(homedir(), '.dsh')
    : resolve(environment.DSH_HOME)
  return join(dshHome, 'profiles', 'web')
}

/** Resolve the settings document shared by plugin-owned configuration cards. */
export function resolveSettingsFile(environment: NodeJS.ProcessEnv = process.env): string {
  const dshHome = environment.DSH_HOME === undefined || environment.DSH_HOME === ''
    ? join(homedir(), '.dsh')
    : resolve(environment.DSH_HOME)
  return join(dshHome, 'settings.yaml')
}

/** Remove manifest-declared plugin namespaces while preserving unrelated YAML nodes. */
export async function cleanupPluginSettings(filename: string, namespaces: readonly string[]): Promise<void> {
  if (namespaces.length === 0) return
  let source: string
  try {
    source = await readFile(filename, 'utf8')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return
    throw error
  }
  const document = parseDocument(source)
  const [documentError] = document.errors
  if (documentError !== undefined) {
    throw new Error(`Invalid settings document: ${documentError.message}`, { cause: documentError })
  }
  let changed = false
  for (const namespace of namespaces) {
    if (!document.has(namespace)) continue
    document.delete(namespace)
    changed = true
  }
  if (changed) await writeFile(filename, document.toString(), { mode: 0o600 })
}

/** Resolve link/file dependency specs to editable local directories. */
export function localPluginPath(spec: string, profileDir: string): string | undefined {
  const match = /^(?:link|file):(.+)$/u.exec(spec)
  if (match === null) return undefined
  const path = match[1]
  if (path === undefined) return undefined
  return isAbsolute(path) ? path : resolve(profileDir, path)
}

/** Remove only the profile-owned package link left after a plugin command; plugin source directories are never deleted. */
export async function cleanupProfilePluginLink(profileDir: string, name: string): Promise<void> {
  if (!/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/iu.test(name)) {
    throw new Error(`Invalid plugin package name: ${name}`)
  }
  const installed = join(profileDir, 'node_modules', ...name.split('/'))
  let stat
  try {
    stat = await lstat(installed)
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return
    throw error
  }
  if (!stat.isSymbolicLink()) throw new Error(`Refusing to delete non-link plugin path: ${installed}`)
  await unlink(installed)
}

async function installedPackageKind(packageDir: string): Promise<DesktopPackageKind> {
  const manifest = JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8')) as ProfileManifest
  if (typeof manifest.dsh?.bundle?.patch === 'string' && manifest.dsh.bundle.patch.length > 0) return 'bundle'
  try {
    await readFile(join(packageDir, 'skill', 'SKILL.md'), 'utf8')
    return 'skill'
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return 'package'
    throw error
  }
}

function installedPackageDir(profileDir: string, name: string, spec: string): string {
  return localPluginPath(spec, profileDir) ?? resolve(profileDir, 'node_modules', ...name.split('/'))
}

/** Read user-installed profile packages while preserving bundle order. */
export async function listProfilePlugins(profileDir: string): Promise<DesktopPlugin[]> {
  const manifestPath = join(profileDir, 'package.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as ProfileManifest
  const dependencies = manifest.dependencies ?? {}
  const hiddenSupport = new Set(managedSupportPackages(manifest.dsh?.desktop?.managedSupportPackages))
  const bundles = Array.isArray(manifest.dsh?.profile?.bundles)
    ? manifest.dsh.profile.bundles.filter((value): value is string => typeof value === 'string')
    : Object.keys(dependencies)
  const ordered = [
    ...bundles.filter(name => dependencies[name] !== undefined && !hiddenSupport.has(name)),
    ...Object.keys(dependencies).filter(name => !bundles.includes(name) && !hiddenSupport.has(name)),
  ]
  return await Promise.all(ordered.flatMap((name) => {
    const spec = dependencies[name]
    if (spec === undefined) return []
    const localPath = localPluginPath(spec, profileDir)
    return [readPlugin(name, spec, bundles.includes(name), localPath, profileDir)]
  }))
}

/** Persist whether an installed dependency participates in the profile bundle stack. */
export async function setProfilePluginEnabled(profileDir: string, name: string, enabled: boolean): Promise<void> {
  if (!/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/iu.test(name)) throw new Error(`Invalid plugin package name: ${name}`)
  const manifestPath = join(profileDir, 'package.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as ProfileManifest
  const dependencies = manifest.dependencies
  const spec = dependencies?.[name]
  if (dependencies === undefined || spec === undefined) throw new Error(`Plugin is not installed: ${name}`)
  const kind = await installedPackageKind(installedPackageDir(profileDir, name, spec))
  if (enabled && kind !== 'bundle') throw new Error(`Cannot enable non-bundle package: ${name}`)
  manifest.dsh ??= {}
  manifest.dsh.profile ??= {}
  const bundles = Array.isArray(manifest.dsh.profile.bundles)
    ? manifest.dsh.profile.bundles.filter((value): value is string => typeof value === 'string')
    : Object.keys(dependencies)
  manifest.dsh.profile.bundles = enabled
    ? [...bundles.filter(bundle => bundle !== name), name]
    : bundles.filter(bundle => bundle !== name)
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
}

async function readPlugin(
  name: string,
  spec: string,
  enabled: boolean,
  localPath: string | undefined,
  profileDir: string,
): Promise<DesktopPlugin> {
  const packageDir = localPath ?? resolve(profileDir, 'node_modules', name)
  try {
    const packageManifest = JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8')) as ProfileManifest
    const kind = await installedPackageKind(packageDir)
    const overlay = desktopOverlay(packageManifest.dsh?.desktop?.overlay)
    const ownedSettings = settingsNamespaces(packageManifest.dsh?.settings?.namespaces)
    const ownedSupport = supportPackages(packageManifest.dsh?.desktop?.supportPackages, packageDir)
    const webSurface = overlay?.entry === 'dsh:web'
    const overlayPath = overlay === undefined || webSurface ? undefined : resolve(packageDir, overlay.entry)
    const overlayRelative = overlayPath === undefined ? undefined : relative(packageDir, overlayPath)
    const safeOverlay = webSurface
      ? overlay
      : overlay !== undefined
        && overlayPath !== undefined
        && overlayRelative !== undefined
        && overlayRelative !== ''
        && !overlayRelative.startsWith('..')
        && !isAbsolute(overlayRelative)
        ? { ...overlay, entry: overlayPath }
        : undefined
    return {
      name,
      spec,
      kind,
      enabled: kind === 'bundle' && enabled,
      ...(localPath === undefined ? {} : { localPath }),
      ...(safeOverlay === undefined ? {} : { desktopOverlay: safeOverlay }),
      ...(ownedSettings === undefined ? {} : { settingsNamespaces: ownedSettings }),
      ...(ownedSupport === undefined ? {} : { supportPackages: ownedSupport }),
    }
  } catch {
    return { name, spec, kind: 'package', enabled: false, ...(localPath === undefined ? {} : { localPath }) }
  }
}

async function removeInvalidProfileBundles(profileDir: string): Promise<void> {
  const manifestPath = join(profileDir, 'package.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as ProfileManifest
  const bundles = Array.isArray(manifest.dsh?.profile?.bundles)
    ? manifest.dsh.profile.bundles.filter((value): value is string => typeof value === 'string')
    : []
  const dependencies = manifest.dependencies ?? {}
  const valid: string[] = []
  for (const name of bundles) {
    const spec = dependencies[name]
    if (spec === undefined || await installedPackageKind(installedPackageDir(profileDir, name, spec)) === 'bundle') {
      valid.push(name)
    }
  }
  if (valid.length === bundles.length) return
  manifest.dsh ??= {}
  manifest.dsh.profile = { ...manifest.dsh.profile, bundles: valid }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
}

/** Reconcile profile-local package aliases required by enabled Desktop plugins. */
export async function syncProfileSupportPackages(
  profileDir: string,
  runtimeEntry: string,
  cwd: string,
  command: typeof runPluginCommand = runPluginCommand,
  required: Readonly<Record<string, string>> = {},
): Promise<void> {
  await removeInvalidProfileBundles(profileDir)
  const plugins = await listProfilePlugins(profileDir)
  const desired = new Map<string, string>(Object.entries(required))
  for (const plugin of plugins) {
    if (!plugin.enabled) continue
    for (const [name, path] of Object.entries(plugin.supportPackages ?? {})) {
      const previous = desired.get(name)
      if (previous !== undefined && previous !== path) {
        throw new Error(`Enabled plugins require conflicting support packages for ${name}`)
      }
      desired.set(name, path)
    }
  }

  const manifestPath = join(profileDir, 'package.json')
  const before = JSON.parse(await readFile(manifestPath, 'utf8')) as ProfileManifest
  const enabledBundles = Array.isArray(before.dsh?.profile?.bundles)
    ? before.dsh.profile.bundles.filter((value): value is string => typeof value === 'string')
    : undefined
  const managed = new Set(managedSupportPackages(before.dsh?.desktop?.managedSupportPackages))
  for (const name of managed) {
    if (!desired.has(name)) {
      await command(runtimeEntry, cwd, ['remove', name])
      await cleanupProfilePluginLink(profileDir, name)
    }
  }
  for (const [name, path] of desired) {
    const expected = `link:${path}`
    if (before.dependencies?.[name] !== expected) {
      await command(runtimeEntry, cwd, ['add', `${name}@${expected}`])
    }
  }

  const after = JSON.parse(await readFile(manifestPath, 'utf8')) as ProfileManifest
  after.dsh ??= {}
  after.dsh.profile ??= {}
  if (enabledBundles === undefined) delete after.dsh.profile.bundles
  else after.dsh.profile.bundles = enabledBundles
  after.dsh.desktop ??= {}
  after.dsh.desktop.managedSupportPackages = [...desired.keys()].sort()
  await writeFile(manifestPath, `${JSON.stringify(after, null, 2)}\n`)
}

/** Execute one profile-management command with argument-safe spawning. */
export async function runPluginCommand(entry: string, cwd: string, args: readonly string[]): Promise<void> {
  const pathEntries = [
    process.env.PNPM_HOME,
    join(homedir(), 'Library', 'pnpm'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
  ].filter((value): value is string => value !== undefined && value !== '' && existsSync(join(value, 'pnpm')))
  const path = [...new Set([...pathEntries, ...(process.env.PATH ?? '').split(delimiter).filter(Boolean)])].join(delimiter)
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(process.execPath, dshNodeArgs(entry, ['plugin', '--profile', 'web', ...args]), {
      cwd,
      env: { ...process.env, PATH: path, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const stderr: string[] = []
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => stderr.push(chunk))
    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`Plugin command failed with exit code ${String(code)}${stderr.length === 0 ? '' : `:\n${stderr.join('').trim()}`}`))
    })
  })
}
