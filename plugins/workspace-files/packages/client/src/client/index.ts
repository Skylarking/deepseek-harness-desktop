/** Client registration for the workspace file-browser utilities and split panel. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@skylarking/dsh-client-ui-workspace-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import workspaceFilesRemote from '@deepseek-ai/dsh-host-workspace-files/remote'
import { en, zh, type WorkspaceFilesKey } from './locales.ts'
import { WorkspaceFilesPanel, WorkspaceFilesTrigger } from './WorkspaceFiles.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Workspace file browser copy. */
    'workspace-files': WorkspaceFilesKey
  }
}

const NS = 'workspace-files'
const UI_INJECT = ['slots', 'locale', 'layout', 'remote', 'remote.workspaceFiles', 'workspaces']

/** Register Hero and Session buttons after the mounted file Remote is injectable. */
function registerWorkspaceFiles(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-workspace-files: dictionaries')
  const layout = ctx.layout
  const list: import('./WorkspaceFiles.tsx').WorkspaceFilesInjected['list'] = async (workspaceId, path) => {
    const result = await ctx.remote.workspaceFiles.list(workspaceId, path)
    if (!result.ok) throw new Error(`workspaceFiles.list failed: ${result.error.code}: ${result.error.message}`)
    return result.value
  }
  const read: import('./WorkspaceFiles.tsx').WorkspaceFilesInjected['read'] = async (workspaceId, path) => {
    const result = await ctx.remote.workspaceFiles.read(workspaceId, path)
    if (!result.ok) throw new Error(`workspaceFiles.read failed: ${result.error.code}: ${result.error.message}`)
    return result.value
  }
  const injected = () => ({
    layout: { toggleRightPanel: () => { layout.toggleRightPanel() } },
    workspaces: ctx.workspaces.list,
    list,
    read,
  })
  ctx.slots.inject('shell.hero.utilities', () => ctx.slots.register({ name: 'shell.hero.utilities', id: 'workspace-files', locale: NS, inject: injected }, WorkspaceFilesTrigger))
  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({ name: 'conversation.session.header.utilities', id: 'workspace-files', locale: NS, inject: injected }, WorkspaceFilesTrigger))
  ctx.slots.inject('shell.rightPanel', () => ctx.slots.register({ name: 'shell.rightPanel', locale: NS, inject: injected }, WorkspaceFilesPanel))
  ctx.effect(() => () => { layout.closeRightPanel() }, 'ui-workspace-files: restore right split on unload')
}

/** Required service for mounting the plugin-owned Remote contribution. */
export const inject = ['remote']

/** Mount the file Remote before starting its UI consumer. */
export async function apply(ctx: ClientContext): Promise<void> {
  await ctx.remote.$mount(workspaceFilesRemote)
  await ctx.inject(UI_INJECT, registerWorkspaceFiles)
}
