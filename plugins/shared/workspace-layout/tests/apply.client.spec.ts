// @vitest-environment jsdom

import { Context } from '@deepseek-ai/cordis'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { describe, expect, it, vi } from 'vitest'
import { apply, inject, LayoutController } from '../src/client/index.ts'

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  ctx.provide('theme', {
    getTheme: () => ({ active: { colorScheme: 'light', tokens: {} } }),
  } as never)
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { ctx, fiber, slots: ctx.slots }
}

describe('workspace layout support package', () => {
  it('owns the reversible split slots while its replacement fiber is mounted', async () => {
    const { ctx, fiber, slots } = await bench()
    expect(ctx.get('layout')).toBeInstanceOf(LayoutController)
    expect(slots.spec('shell.rightPanel')).toEqual({ kind: 'single', scope: 'root' })
    expect(slots.spec('shell.bottomPanel')).toEqual({ kind: 'single', scope: 'root' })
    expect(slots.spec('shell.hero.utilities')).toEqual({ kind: 'list', scope: 'root' })

    const actions = {
      setSidebar: vi.fn(), setDetails: vi.fn(), setAuxiliaryRight: vi.fn(), setAuxiliaryBottom: vi.fn(),
      toggleSidebar: vi.fn(), setNarrow: vi.fn(), openDetails: vi.fn(), closeDetails: vi.fn(),
      toggleRightPanel: vi.fn(), closeRightPanel: vi.fn(), toggleBottomPanel: vi.fn(), closeBottomPanel: vi.fn(),
    }
    ;(slots.entries('root')[0]!.inject as (value: never) => object)(actions as never)
    ;(ctx.layout as LayoutController).toggleRightPanel()
    expect(actions.toggleRightPanel).toHaveBeenCalledOnce()

    await fiber.dispose()
    expect(ctx.get('layout')).toBeUndefined()
    expect(slots.spec('shell.rightPanel')).toBeUndefined()
    expect(slots.spec('shell.bottomPanel')).toBeUndefined()
    expect(slots.spec('shell.hero.utilities')).toBeUndefined()
    expect(slots.spec('root')).toEqual({ kind: 'single', scope: 'root' })
  })
})
