/** Stage a production DSH dependency closure for electron-builder extraResources. */
import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const desktopDir = fileURLToPath(new URL('..', import.meta.url))
const repositoryDir = fileURLToPath(new URL('../../..', import.meta.url))
const target = fileURLToPath(new URL('../.runtime', import.meta.url))
// macOS exposes /var as a symlink to /private/var. Give pnpm the canonical
// destination so its deeply relative workspace links do not end one level short.
const temporaryRoot = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-desktop-runtime-')))
const staged = join(temporaryRoot, 'runtime')

interface PackageManifest {
  name?: string
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  peerDependenciesMeta?: Record<string, { optional?: boolean }>
}

function readManifest(directory: string): PackageManifest {
  return JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')) as PackageManifest
}

function copyWorkspacePackage(source: string, destination: string): void {
  mkdirSync(dirname(destination), { recursive: true })
  cpSync(source, destination, {
    recursive: true,
    filter: (path) => {
      const pathRelative = relative(source, path)
      return pathRelative === ''
        || !pathRelative.split(sep).some(segment => segment === 'node_modules' || segment === '.runtime')
    },
  })
}

function workspacePackageCatalog(repository: string): Map<string, string> {
  const packages = new Map<string, string>()
  const add = (directory: string): void => {
    if (!existsSync(join(directory, 'package.json'))) return
    const name = readManifest(directory).name
    if (name !== undefined) packages.set(name, directory)
  }
  const addChildren = (directory: string): void => {
    if (!existsSync(directory)) return
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) add(join(directory, entry.name))
    }
  }
  addChildren(join(repository, 'vendor'))
  for (const group of readdirSync(join(repository, 'packages'), { withFileTypes: true })) {
    if (group.isDirectory()) addChildren(join(repository, 'packages', group.name))
  }
  addChildren(join(repository, 'apps'))
  add(join(repository, 'native', 'landlock-run'))
  addChildren(join(repository, 'native', 'landlock-run', 'packages'))
  return packages
}

function workspaceClosure(roots: readonly string[], catalog: ReadonlyMap<string, string>): Map<string, string> {
  const closure = new Map<string, string>()
  const queue = [...roots]
  for (let source = queue.shift(); source !== undefined; source = queue.shift()) {
    const manifest = readManifest(source)
    if (manifest.name === undefined || closure.has(manifest.name)) continue
    closure.set(manifest.name, source)
    for (const dependency of [
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.peerDependencies ?? {}),
    ]) {
      const dependencySource = catalog.get(dependency)
      if (dependencySource !== undefined && !closure.has(dependency)) queue.push(dependencySource)
    }
  }
  return closure
}

function externalLinks(root: string): Map<string, string[]> {
  const canonicalRoot = realpathSync(root)
  const links = new Map<string, string[]>()
  const walk = (directory: string): void => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name)
      const stat = lstatSync(path)
      if (stat.isSymbolicLink()) {
        const destination = realpathSync(path)
        if (destination === canonicalRoot || destination.startsWith(canonicalRoot + sep)) continue
        links.set(destination, [...links.get(destination) ?? [], path])
      } else if (stat.isDirectory()) {
        walk(path)
      }
    }
  }
  walk(canonicalRoot)
  return links
}

function makeRuntimeSelfContained(root: string): void {
  const canonicalRepository = realpathSync(repositoryDir)
  const cliSource = join(canonicalRepository, 'apps', 'cli')
  const materializedRoot = join(root, '.workspace')
  const escaped = externalLinks(root)
  const destinations = new Map<string, string>()
  const packageDestinations = new Map<string, string>()
  const copiedPackages = new Map<string, string>()
  for (const source of escaped.keys()) {
    const sourceRelative = relative(canonicalRepository, source)
    if (isAbsolute(sourceRelative) || sourceRelative === '..' || sourceRelative.startsWith(`..${sep}`)) {
      throw new Error(`Staged DSH runtime links outside the repository: ${source}`)
    }
    const destination = source === cliSource ? root : join(materializedRoot, sourceRelative)
    destinations.set(source, destination)
    if (source !== cliSource) {
      copyWorkspacePackage(source, destination)
      const name = readManifest(source).name
      if (name !== undefined) {
        packageDestinations.set(name, destination)
        copiedPackages.set(name, source)
      }
    }
  }
  const catalog = workspacePackageCatalog(canonicalRepository)
  for (const [name, source] of workspaceClosure([cliSource], catalog)) {
    let destination = packageDestinations.get(name)
    if (destination === undefined) {
      const deployed = join(root, 'node_modules', '.pnpm', 'node_modules', ...name.split('/'))
      if (existsSync(deployed)) destination = deployed
      else {
        destination = join(materializedRoot, relative(canonicalRepository, source))
        copyWorkspacePackage(source, destination)
        copiedPackages.set(name, source)
      }
      packageDestinations.set(name, destination)
    }
    const flatLink = join(root, 'node_modules', ...name.split('/'))
    if (!existsSync(flatLink)) {
      mkdirSync(dirname(flatLink), { recursive: true })
      symlinkSync(relative(dirname(flatLink), destination), flatLink, 'dir')
    }
  }
  for (const [name, source] of copiedPackages) {
    const destination = packageDestinations.get(name)!
    const manifest = readManifest(source)
    const dependencies = new Set([
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.peerDependencies ?? {}),
    ])
    for (const dependency of dependencies) {
      const dependencyTarget = packageDestinations.get(dependency)
        ?? join(root, 'node_modules', '.pnpm', 'node_modules', ...dependency.split('/'))
      if (!existsSync(dependencyTarget)) {
        if (manifest.peerDependenciesMeta?.[dependency]?.optional === true) continue
        throw new Error(`Cannot materialize dependency ${dependency} for ${source}`)
      }
      const dependencyLink = join(destination, 'node_modules', ...dependency.split('/'))
      mkdirSync(dirname(dependencyLink), { recursive: true })
      symlinkSync(relative(dirname(dependencyLink), dependencyTarget), dependencyLink, 'dir')
    }
  }
  for (const [source, links] of escaped) {
    const destination = destinations.get(source)!
    for (const link of links) {
      unlinkSync(link)
      symlinkSync(relative(dirname(link), destination), link, lstatSync(destination).isDirectory() ? 'dir' : 'file')
    }
  }
  const remaining = externalLinks(root)
  if (remaining.size > 0) {
    throw new Error(`Staged DSH runtime is not self-contained: ${[...remaining.keys()].join(', ')}`)
  }
}

try {
  // An out-of-workspace destination makes deploy materialize workspace packages
  // instead of linking the staged runtime back into this checkout.
  execFileSync('pnpm', ['--filter', '@deepseek-ai/dsh', 'deploy', '--legacy', staged], {
    cwd: repositoryDir,
    env: { ...process.env, CI: process.env.CI ?? 'true' },
    stdio: 'inherit',
  })
  makeRuntimeSelfContained(staged)
  // This script owns only apps/desktop/.runtime. Keep the previous generation
  // intact until deploy has completed successfully.
  rmSync(target, { force: true, recursive: true })
  renameSync(staged, target)
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true })
}
console.log(`Staged self-contained DSH runtime for ${resolve(desktopDir)}`)
