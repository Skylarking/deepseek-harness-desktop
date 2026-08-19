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
  const call = vi.fn(async () => ({ ok: true, value: { sessionId: 'terminal-1' } }))
  ctx.provide('connection', { rpc: { call } } as never)
  await ctx.plugin({ inject: gatewayInject, apply: applyGateway })
  await ctx.plugin(SlotRegistry).await()
  ctx.slots.register({
    name: 'root',
    children: {
      'shell.hero.utilities': { kind: 'list', scope: 'root' },
      'conversation.session.header.utilities': { kind: 'list', scope: 'session' },
      'shell.bottomPanel': { kind: 'single', scope: 'root' },
    },
  } as never, () => null)
  ctx.provide('locale', new LocaleRuntime(ctx))
  const layout = { toggleBottomPanel: vi.fn(), closeBottomPanel: vi.fn() }
  ctx.provide('layout', layout as never)
  ctx.provide('workspaces', { list: { getSnapshot: () => ({ items: [] }), subscribe: () => () => {} } } as never)
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { ctx, fiber, layout, call }
}

describe('ui-workspace-console apply', () => {
  it('registers hero and session utilities with the bottom split, then removes all three on unload', async () => {
    const { ctx, fiber, layout, call } = await bench()
    expect(ctx.slots.entries('shell.hero.utilities').map(entry => entry.options.id)).toContain('workspace-console')
    expect(ctx.slots.entries('conversation.session.header.utilities').map(entry => entry.options.id)).toContain('workspace-console')
    expect(ctx.slots.entries('shell.bottomPanel')).toHaveLength(1)
    const header = ctx.slots.entries('conversation.session.header.utilities')[0]!
    const props = (header.inject as () => { layout: { toggleBottomPanel: () => void } })()
    props.layout.toggleBottomPanel()
    expect(layout.toggleBottomPanel).toHaveBeenCalledOnce()
    const panel = ctx.slots.entries('shell.bottomPanel')[0]!
    const panelProps = (panel.inject as () => {
      terminal: { open: (workspaceId: string, cols: number, rows: number) => Promise<unknown> }
    })()
    await expect(panelProps.terminal.open('workspace-1', 80, 24)).resolves.toBe('terminal-1')
    expect(call).toHaveBeenCalledWith('/api', 'workspaceConsole/open', {
      args: { workspaceId: 'workspace-1', cols: 80, rows: 24 },
    }, expect.any(AbortSignal))
    await fiber.dispose()
    expect(ctx.get('remote.workspaceConsole')).toBeUndefined()
    expect(ctx.slots.entries('shell.hero.utilities')).toHaveLength(0)
    expect(ctx.slots.entries('conversation.session.header.utilities')).toHaveLength(0)
    expect(ctx.slots.entries('shell.bottomPanel')).toHaveLength(0)
    expect(layout.closeBottomPanel).toHaveBeenCalledOnce()
  })
})
