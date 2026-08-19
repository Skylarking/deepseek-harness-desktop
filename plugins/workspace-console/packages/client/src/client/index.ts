/** Register the workspace command console triggers and bottom split. */
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@skylarking/dsh-client-ui-workspace-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import workspaceConsoleRemote from '@deepseek-ai/dsh-host-workspace-console/remote'
import type { WorkspaceConsoleOpenResult, WorkspaceConsoleReadResult } from '@deepseek-ai/dsh-host-workspace-console/types'
import { en, zh, type WorkspaceConsoleKey } from './locales.ts'
import { WorkspaceConsolePanel, WorkspaceConsoleTrigger, type WorkspaceConsoleInjected } from './WorkspaceConsole.tsx'
declare module '@deepseek-ai/dsh-client-ui-slots' { interface LocaleNamespaceMap { 'workspace-console': WorkspaceConsoleKey } }
const NS = 'workspace-console'
type RemoteResult<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string } }
const UI_INJECT = ['slots', 'locale', 'layout', 'remote', 'remote.workspaceConsole', 'workspaces']

/** Install Hero and Session triggers after the mounted terminal Remote is injectable. */
function registerWorkspaceConsole(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-workspace-console: dictionaries')
  const layout = ctx.layout
  const unwrap = <T>(operation: string, result: RemoteResult<T>): T => {
    if (!result.ok) throw new Error(`workspaceConsole.${operation} failed: ${result.error.code}: ${result.error.message}`)
    return result.value
  }
  const terminal: WorkspaceConsoleInjected['terminal'] = {
    open: async (workspaceId, cols, rows) => {
      const result = await ctx.remote.workspaceConsole.open(workspaceId, cols, rows)
      return unwrap<WorkspaceConsoleOpenResult>('open', result).sessionId
    },
    write: async (sessionId, data) => { unwrap<void>('write', await ctx.remote.workspaceConsole.write(sessionId, data)) },
    read: async (sessionId, offset) => unwrap<WorkspaceConsoleReadResult>('read', await ctx.remote.workspaceConsole.read(sessionId, offset)),
    resize: async (sessionId, cols, rows) => { unwrap<void>('resize', await ctx.remote.workspaceConsole.resize(sessionId, cols, rows)) },
    close: async (sessionId) => { unwrap<void>('close', await ctx.remote.workspaceConsole.close(sessionId)) },
  }
  const injected = () => ({
    layout: { toggleBottomPanel: () => { layout.toggleBottomPanel() } },
    workspaces: ctx.workspaces.list,
    terminal,
  })
  ctx.slots.inject('shell.hero.utilities', () => ctx.slots.register({ name: 'shell.hero.utilities', id: 'workspace-console', order: 20, locale: NS, inject: injected }, WorkspaceConsoleTrigger))
  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({ name: 'conversation.session.header.utilities', id: 'workspace-console', order: 20, locale: NS, inject: injected }, WorkspaceConsoleTrigger))
  ctx.slots.inject('shell.bottomPanel', () => ctx.slots.register({ name: 'shell.bottomPanel', locale: NS, inject: injected }, WorkspaceConsolePanel))
  ctx.effect(() => () => { layout.closeBottomPanel() }, 'ui-workspace-console: restore bottom split on unload')
}

/** Required service for mounting the plugin-owned Remote contribution. */
export const inject = ['remote']

/** Mount the terminal Remote before starting its UI consumer. */
export async function apply(ctx: ClientContext): Promise<void> {
  await ctx.remote.$mount(workspaceConsoleRemote)
  await ctx.inject(UI_INJECT, registerWorkspaceConsole)
}
