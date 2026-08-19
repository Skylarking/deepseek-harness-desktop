import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { apply as applyGateway, inject as gatewayInject } from '@deepseek-ai/dsh-api-gateway/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import { apply, inject } from '../src/client/index.ts'

async function bench() {
  const ctx = new Context()
  await ctx.plugin(TypertRegistry)
  const call = vi.fn(async () => ({ ok: true, value: { path: '', entries: [], truncated: false } }))
  ctx.provide('connection', { rpc: { call } } as never)
  await ctx.plugin({ inject: gatewayInject, apply: applyGateway })
  await ctx.plugin(SlotRegistry).await()
  ctx.slots.register({
    name: 'root',
    children: {
      'shell.hero.utilities': { kind: 'list', scope: 'root' },
      'conversation.session.header.utilities': { kind: 'list', scope: 'session' },
      'shell.rightPanel': { kind: 'single', scope: 'root' },
    },
  } as never, () => null)
  ctx.provide('locale', new LocaleRuntime(ctx))
  const layout = { toggleRightPanel: vi.fn(), closeRightPanel: vi.fn() }
  ctx.provide('layout', layout as never)
  ctx.provide('workspaces', { list: { getSnapshot: () => ({ items: [] }), subscribe: () => () => {} } } as never)
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { ctx, fiber, layout, call }
}

describe('ui-workspace-files apply', () => {
  it('registers hero and session utilities with the right split, then removes all three on unload', async () => {
    const { ctx, fiber, layout, call } = await bench()
    expect(ctx.slots.entries('shell.hero.utilities').map(entry => entry.options.id)).toContain('workspace-files')
    expect(ctx.slots.entries('conversation.session.header.utilities').map(entry => entry.options.id)).toContain('workspace-files')
    expect(ctx.slots.entries('shell.rightPanel')).toHaveLength(1)
    const header = ctx.slots.entries('conversation.session.header.utilities')[0]!
    const props = (header.inject as () => { layout: { toggleRightPanel: () => void } })()
    props.layout.toggleRightPanel()
    expect(layout.toggleRightPanel).toHaveBeenCalledOnce()
    const panel = ctx.slots.entries('shell.rightPanel')[0]!
    const panelProps = (panel.inject as () => {
      list: (workspaceId: string, path: string) => Promise<unknown>
    })()
    await expect(panelProps.list('workspace-1', '')).resolves.toEqual({ path: '', entries: [], truncated: false })
    expect(call).toHaveBeenCalledWith('/api', 'workspaceFiles/list', {
      args: { workspaceId: 'workspace-1', path: '' },
    }, expect.any(AbortSignal))
    await fiber.dispose()
    expect(ctx.get('remote.workspaceFiles')).toBeUndefined()
    expect(ctx.slots.entries('shell.hero.utilities')).toHaveLength(0)
    expect(ctx.slots.entries('conversation.session.header.utilities')).toHaveLength(0)
    expect(ctx.slots.entries('shell.rightPanel')).toHaveLength(0)
    expect(layout.closeRightPanel).toHaveBeenCalledOnce()
  })
})
