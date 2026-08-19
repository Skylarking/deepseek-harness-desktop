import { lstat, mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  cleanupPluginSettings, cleanupProfilePluginLink, listProfilePlugins, localPluginPath,
  removeRetiredDesktopDefaults, resolveSettingsFile, setProfilePluginEnabled,
  syncProfileSupportPackages,
} from '../src/plugin-manager.ts'

describe('plugin profile discovery', () => {
  it.each([
    ['workspace-files', '@deepseek-ai/dsh-client-ui-workspace-files', '@deepseek-ai/dsh-host-workspace-files'],
    ['workspace-console', '@deepseek-ai/dsh-client-ui-workspace-console', '@deepseek-ai/dsh-host-workspace-console'],
  ])('discovers every loader package owned by the repository %s plugin', async (directory, client, host) => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-desktop-repository-plugin-'))
    const plugin = join(import.meta.dirname, '..', '..', '..', 'plugins', directory)
    await writeFile(join(root, 'package.json'), JSON.stringify({
      dependencies: { local: `link:${plugin}` },
      dsh: { profile: { bundles: ['local'] } },
    }))

    const [installed] = await listProfilePlugins(root)
    expect(installed?.supportPackages).toEqual({
      '@deepseek-ai/dsh-client-ui-layout': join(plugin, '..', 'shared', 'workspace-layout'),
      [client]: join(plugin, 'packages', 'client'),
      [host]: join(plugin, 'packages', 'host'),
    })
  })

  it('retires only recorded defaults that point into the Desktop runtime', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-desktop-retired-defaults-'))
    const profile = join(root, 'profile')
    const runtime = join(root, 'runtime')
    await mkdir(profile)
    await writeFile(join(profile, 'package.json'), JSON.stringify({
      dependencies: {
        '@deepseek-ai/dsh-workspace-files': `link:${join(runtime, 'node_modules/@deepseek-ai/dsh-workspace-files')}`,
        '@deepseek-ai/dsh-workspace-console': 'link:/plugins/workspace-console',
      },
      dsh: {
        profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-workspace-files', '@deepseek-ai/dsh-workspace-console'] },
        desktop: { defaultPlugins: ['@deepseek-ai/dsh-workspace-files', '@deepseek-ai/dsh-workspace-console'] },
      },
    }))

    await expect(removeRetiredDesktopDefaults(profile, join(runtime, 'lib/bin.js')))
      .resolves.toEqual(['@deepseek-ai/dsh-workspace-files'])
    const manifest = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>
      dsh: { profile: { bundles: string[] }; desktop: { defaultPlugins?: string[] } }
    }
    expect(manifest.dependencies['@deepseek-ai/dsh-workspace-files']).toBeUndefined()
    expect(manifest.dependencies['@deepseek-ai/dsh-workspace-console']).toBe('link:/plugins/workspace-console')
    expect(manifest.dsh.profile.bundles).toEqual(['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-workspace-console'])
    expect(manifest.dsh.desktop.defaultPlugins).toBeUndefined()
  })

  it('keeps profile bundle order and exposes only dependency-backed custom plugins', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-desktop-profile-'))
    await mkdir(join(root, 'plugin'))
    await writeFile(join(root, 'package.json'), JSON.stringify({
      dependencies: {
        local: 'link:./plugin',
        registry: '^1.2.3',
      },
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', 'registry', 'local'] } },
    }))

    await expect(listProfilePlugins(root)).resolves.toEqual([
      { name: 'registry', spec: '^1.2.3', enabled: true },
      { name: 'local', spec: 'link:./plugin', enabled: true, localPath: join(root, 'plugin') },
    ])
  })

  it('keeps installed dependencies visible when disabled and can re-enable them', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-desktop-enable-plugin-'))
    await mkdir(join(root, 'plugin'))
    await writeFile(join(root, 'package.json'), JSON.stringify({
      dependencies: { local: 'link:./plugin' },
      dsh: { profile: { bundles: [] } },
    }))

    await expect(listProfilePlugins(root)).resolves.toEqual([{
      name: 'local', spec: 'link:./plugin', enabled: false, localPath: join(root, 'plugin'),
    }])
    await setProfilePluginEnabled(root, 'local', true)
    await expect(listProfilePlugins(root)).resolves.toEqual([{
      name: 'local', spec: 'link:./plugin', enabled: true, localPath: join(root, 'plugin'),
    }])
    await setProfilePluginEnabled(root, 'local', false)
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>
      dsh: { profile: { bundles: string[] } }
    }
    expect(manifest.dependencies.local).toBe('link:./plugin')
    expect(manifest.dsh.profile.bundles).toEqual([])
  })

  it('hides managed support aliases and removes the last one when its plugin is disabled', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-desktop-support-package-'))
    const plugin = join(root, 'plugin')
    const support = join(root, 'support')
    await mkdir(plugin)
    await mkdir(support)
    await writeFile(join(plugin, 'package.json'), JSON.stringify({
      dsh: { desktop: { supportPackages: { '@deepseek-ai/dsh-client-ui-layout': '../support' } } },
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
      dsh: { desktop: { overlay: { entry: './desktop.html', width: 164, height: 164 } } },
    }))
    await writeFile(join(root, 'package.json'), JSON.stringify({
      dependencies: { local: 'link:./plugin' },
      dsh: { profile: { bundles: ['local'] } },
    }))

    await expect(listProfilePlugins(root)).resolves.toEqual([{
      name: 'local',
      spec: 'link:./plugin',
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

  it('refuses to delete a non-link plugin path from the profile', async () => {
    const profile = await mkdtemp(join(tmpdir(), 'dsh-desktop-real-plugin-'))
    await mkdir(join(profile, 'node_modules', 'local'), { recursive: true })

    await expect(cleanupProfilePluginLink(profile, 'local'))
      .rejects.toThrow('Refusing to delete non-link plugin path')
  })
})
