import { chmod, lstat, mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  cleanupPluginSettings, cleanupProfilePluginLink, listProfilePlugins, localPluginPath,
  removeRetiredDesktopDefaults, resolveSettingsFile, runPluginCommand, setProfilePluginEnabled,
  syncProfileSupportPackages,
} from '../src/plugin-manager.ts'

describe('plugin profile discovery', () => {
  it('retires only recorded defaults that point into the Desktop runtime', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-desktop-retired-defaults-'))
    const profile = join(root, 'profile')
    const runtime = join(root, 'runtime')
    await mkdir(profile)
    await writeFile(join(profile, 'package.json'), JSON.stringify({
      dependencies: {
        '@legacy/retired-runtime-plugin': `link:${join(runtime, 'node_modules/@legacy/retired-runtime-plugin')}`,
        '@example/external-plugin': 'link:/plugins/external-plugin',
      },
      dsh: {
        profile: { bundles: ['@deepseek-ai/dsh-base', '@legacy/retired-runtime-plugin', '@example/external-plugin'] },
        desktop: { defaultPlugins: ['@legacy/retired-runtime-plugin', '@example/external-plugin'] },
      },
    }))

    await expect(removeRetiredDesktopDefaults(profile, join(runtime, 'lib/bin.js')))
      .resolves.toEqual(['@legacy/retired-runtime-plugin'])
    const manifest = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>
      dsh: { profile: { bundles: string[] }; desktop: { defaultPlugins?: string[] } }
    }
    expect(manifest.dependencies['@legacy/retired-runtime-plugin']).toBeUndefined()
    expect(manifest.dependencies['@example/external-plugin']).toBe('link:/plugins/external-plugin')
    expect(manifest.dsh.profile.bundles).toEqual(['@deepseek-ai/dsh-base', '@example/external-plugin'])
    expect(manifest.dsh.desktop.defaultPlugins).toBeUndefined()
  })

  it('keeps profile bundle order and exposes only dependency-backed custom plugins', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-desktop-profile-'))
    await mkdir(join(root, 'plugin'))
    await mkdir(join(root, 'node_modules', 'registry'), { recursive: true })
    const bundleManifest = JSON.stringify({ dsh: { bundle: { patch: './cordis.patch.yml' } } })
    await writeFile(join(root, 'plugin', 'package.json'), bundleManifest)
    await writeFile(join(root, 'node_modules', 'registry', 'package.json'), bundleManifest)
    await writeFile(join(root, 'package.json'), JSON.stringify({
      dependencies: {
        local: 'link:./plugin',
        registry: '^1.2.3',
      },
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', 'registry', 'local'] } },
    }))

    await expect(listProfilePlugins(root)).resolves.toEqual([
      { name: 'registry', spec: '^1.2.3', kind: 'bundle', enabled: true },
      { name: 'local', spec: 'link:./plugin', kind: 'bundle', enabled: true, localPath: join(root, 'plugin') },
    ])
  })

  it('keeps disabled bundles visible and can re-enable them', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-desktop-enable-plugin-'))
    await mkdir(join(root, 'plugin'))
    await writeFile(join(root, 'plugin', 'package.json'), JSON.stringify({
      dsh: { bundle: { patch: './cordis.patch.yml' } },
    }))
    await writeFile(join(root, 'package.json'), JSON.stringify({
      dependencies: { local: 'link:./plugin' },
      dsh: { profile: { bundles: [] } },
    }))

    await expect(listProfilePlugins(root)).resolves.toEqual([{
      name: 'local', spec: 'link:./plugin', kind: 'bundle', enabled: false, localPath: join(root, 'plugin'),
    }])
    await setProfilePluginEnabled(root, 'local', true)
    await expect(listProfilePlugins(root)).resolves.toEqual([{
      name: 'local', spec: 'link:./plugin', kind: 'bundle', enabled: true, localPath: join(root, 'plugin'),
    }])
    await setProfilePluginEnabled(root, 'local', false)
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>
      dsh: { profile: { bundles: string[] } }
    }
    expect(manifest.dependencies.local).toBe('link:./plugin')
    expect(manifest.dsh.profile.bundles).toEqual([])
  })

  it('classifies skill packages separately and refuses to enable them as bundles', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-desktop-skill-package-'))
    const skillPackage = join(root, 'skill-package')
    await mkdir(join(skillPackage, 'skill'), { recursive: true })
    await writeFile(join(skillPackage, 'package.json'), JSON.stringify({ name: 'local-skill' }))
    await writeFile(join(skillPackage, 'skill', 'SKILL.md'), '# Local skill\n')
    await writeFile(join(root, 'package.json'), JSON.stringify({
      dependencies: { 'local-skill': 'link:./skill-package' },
      dsh: { profile: { bundles: [] } },
    }))

    await expect(listProfilePlugins(root)).resolves.toEqual([{
      name: 'local-skill',
      spec: 'link:./skill-package',
      kind: 'skill',
      enabled: false,
      localPath: skillPackage,
    }])
    await expect(setProfilePluginEnabled(root, 'local-skill', true))
      .rejects.toThrow('Cannot enable non-bundle package: local-skill')
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
      dsh: { profile: { bundles: string[] } }
    }
    expect(manifest.dsh.profile.bundles).toEqual([])
  })

  it('removes dependency-backed non-bundles from a stale enabled list during Desktop sync', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-desktop-stale-package-'))
    const plainPackage = join(root, 'plain-package')
    await mkdir(plainPackage)
    await writeFile(join(plainPackage, 'package.json'), JSON.stringify({ name: 'plain-package' }))
    await writeFile(join(root, 'package.json'), JSON.stringify({
      dependencies: { 'plain-package': 'link:./plain-package' },
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', 'plain-package'] } },
    }))

    await syncProfileSupportPackages(root, '/runtime/dsh.js', root, async () => {})

    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
      dsh: { profile: { bundles: string[] } }
    }
    expect(manifest.dsh.profile.bundles).toEqual(['@deepseek-ai/dsh-base'])
  })

  it('hides managed support aliases and removes the last one when its plugin is disabled', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-desktop-support-package-'))
    const plugin = join(root, 'plugin')
    const support = join(root, 'support')
    await mkdir(plugin)
    await mkdir(support)
    await writeFile(join(plugin, 'package.json'), JSON.stringify({
      dsh: {
        bundle: { patch: './cordis.patch.yml' },
        desktop: { supportPackages: { '@deepseek-ai/dsh-client-ui-layout': '../support' } },
      },
    }))
    await writeFile(join(root, 'package.json'), JSON.stringify({
      dependencies: { local: 'link:./plugin' },
      dsh: { profile: { bundles: ['local'] }, desktop: { managedSupportPackages: [] } },
    }))

    const command = async (_entry: string, _cwd: string, args: readonly string[]): Promise<void> => {
      const manifestPath = join(root, 'package.json')
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
        dependencies: Record<string, string>
        dsh: { profile: { bundles: string[] } }
      }
      if (args[0] === 'add') {
        manifest.dependencies['@deepseek-ai/dsh-client-ui-layout'] = `link:${support}`
        const installed = join(root, 'node_modules', '@deepseek-ai', 'dsh-client-ui-layout')
        await mkdir(join(root, 'node_modules', '@deepseek-ai'), { recursive: true })
        await symlink(support, installed, process.platform === 'win32' ? 'junction' : 'dir')
      } else {
        delete manifest.dependencies['@deepseek-ai/dsh-client-ui-layout']
      }
      // The DSH plugin command derives bundle enablement from dependencies.
      // Desktop must restore its pre-command snapshot for support-only aliases.
      manifest.dsh.profile.bundles = Object.keys(manifest.dependencies)
      await writeFile(manifestPath, JSON.stringify(manifest))
    }

    await syncProfileSupportPackages(root, '/runtime/dsh.js', root, command)
    await expect(listProfilePlugins(root)).resolves.toEqual([{
      name: 'local',
      spec: 'link:./plugin',
      kind: 'bundle',
      enabled: true,
      localPath: plugin,
      supportPackages: { '@deepseek-ai/dsh-client-ui-layout': support },
    }])
    await setProfilePluginEnabled(root, 'local', false)
    await syncProfileSupportPackages(root, '/runtime/dsh.js', root, command)
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>
      dsh: { profile: { bundles: string[] }; desktop: { managedSupportPackages: string[] } }
    }
    expect(manifest.dependencies['@deepseek-ai/dsh-client-ui-layout']).toBeUndefined()
    expect(manifest.dsh.profile.bundles).toEqual([])
    expect(manifest.dsh.desktop.managedSupportPackages).toEqual([])
    await expect(lstat(join(root, 'node_modules', '@deepseek-ai', 'dsh-client-ui-layout')))
      .rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('does not treat registry ranges as editable paths', () => {
    expect(localPluginPath('^1.0.0', '/profile')).toBeUndefined()
  })

  it('reads a contained desktop overlay declared by the plugin package', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-desktop-overlay-'))
    const plugin = join(root, 'plugin')
    await mkdir(plugin)
    await writeFile(join(plugin, 'package.json'), JSON.stringify({
      dsh: {
        bundle: { patch: './cordis.patch.yml' },
        desktop: { overlay: { entry: './desktop.html', width: 164, height: 164 } },
      },
    }))
    await writeFile(join(root, 'package.json'), JSON.stringify({
      dependencies: { local: 'link:./plugin' },
      dsh: { profile: { bundles: ['local'] } },
    }))

    await expect(listProfilePlugins(root)).resolves.toEqual([{
      name: 'local',
      spec: 'link:./plugin',
      kind: 'bundle',
      enabled: true,
      localPath: plugin,
      desktopOverlay: { entry: join(plugin, 'desktop.html'), width: 164, height: 164 },
    }])
  })

  it('accepts the host-provided web surface without resolving it as a file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-desktop-web-overlay-'))
    const plugin = join(root, 'plugin')
    await mkdir(plugin)
    await writeFile(join(plugin, 'package.json'), JSON.stringify({
      dsh: {
        bundle: { patch: './cordis.patch.yml' },
        desktop: { overlay: {
          entry: 'dsh:web',
          width: 164,
          height: 164,
          expandedWidth: 360,
          expandedHeight: 520,
        } },
        settings: { namespaces: ['codex-pets'] },
      },
    }))
    await writeFile(join(root, 'package.json'), JSON.stringify({
      dependencies: { local: 'link:./plugin' },
      dsh: { profile: { bundles: ['local'] } },
    }))

    await expect(listProfilePlugins(root)).resolves.toEqual([{
      name: 'local',
      spec: 'link:./plugin',
      kind: 'bundle',
      enabled: true,
      localPath: plugin,
      desktopOverlay: {
        entry: 'dsh:web',
        width: 164,
        height: 164,
        expandedWidth: 360,
        expandedHeight: 520,
      },
      settingsNamespaces: ['codex-pets'],
    }])
  })

  it('removes only manifest-owned settings when uninstalling a plugin', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-desktop-plugin-settings-'))
    const settings = join(root, 'settings.yaml')
    await writeFile(settings, [
      '# user settings',
      'codex-pets:',
      '  enabled: false',
      '  scale: 1.5',
      'ui-theme:',
      '  theme: dark',
      '',
    ].join('\n'))

    await cleanupPluginSettings(settings, ['codex-pets'])

    const source = await readFile(settings, 'utf8')
    expect(source).not.toContain('codex-pets')
    expect(source).toContain('ui-theme:')
    expect(source).toContain('theme: dark')
  })

  it('resolves settings beside profiles under the selected DSH home', () => {
    expect(resolveSettingsFile({ DSH_HOME: '/tmp/dsh-test-home' }))
      .toBe('/tmp/dsh-test-home/settings.yaml')
  })

  it('unlinks a removed plugin from the profile without deleting its source', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-desktop-remove-plugin-'))
    const profile = join(root, 'profile')
    const source = join(root, 'source')
    const installed = join(profile, 'node_modules', 'local')
    await mkdir(join(profile, 'node_modules'), { recursive: true })
    await mkdir(source)
    await writeFile(join(source, 'sentinel'), 'owned by plugin source')
    await symlink(source, installed, process.platform === 'win32' ? 'junction' : 'dir')

    await cleanupProfilePluginLink(profile, 'local')

    await expect(lstat(installed)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(lstat(join(source, 'sentinel'))).resolves.toBeDefined()
  })

  it.runIf(process.platform !== 'win32')('finds pnpm in the standard user install directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-desktop-pnpm-path-'))
    const pnpmDir = join(root, 'Library', 'pnpm')
    const entry = join(root, 'entry.mjs')
    await mkdir(pnpmDir, { recursive: true })
    await writeFile(join(pnpmDir, 'pnpm'), '#!/bin/sh\nexit 0\n')
    await chmod(join(pnpmDir, 'pnpm'), 0o755)
    await writeFile(entry, [
      "import { spawnSync } from 'node:child_process'",
      "const result = spawnSync('pnpm', [], { stdio: 'inherit' })",
      'if (result.error !== undefined) throw result.error',
      'process.exit(result.status ?? 1)',
      '',
    ].join('\n'))

    const previousHome = process.env.HOME
    const previousPath = process.env.PATH
    process.env.HOME = root
    process.env.PATH = '/usr/bin:/bin'
    try {
      await expect(runPluginCommand(entry, root, [])).resolves.toBeUndefined()
    } finally {
      if (previousHome === undefined) delete process.env.HOME
      else process.env.HOME = previousHome
      if (previousPath === undefined) delete process.env.PATH
      else process.env.PATH = previousPath
    }
  })

  it('refuses to delete a non-link plugin path from the profile', async () => {
    const profile = await mkdtemp(join(tmpdir(), 'dsh-desktop-real-plugin-'))
    await mkdir(join(profile, 'node_modules', 'local'), { recursive: true })

    await expect(cleanupProfilePluginLink(profile, 'local'))
      .rejects.toThrow('Refusing to delete non-link plugin path')
  })
})
