import { describe, expect, it, vi } from 'vitest'
import { revealLoadingWindow, runDesktopBoot } from '../src/desktop-boot.ts'

describe('revealLoadingWindow', () => {
  it('shows and focuses the window only after its document loads', async () => {
    const order: string[] = []

    await revealLoadingWindow({
      loadURL: async () => { order.push('load') },
      show: () => { order.push('show') },
      focus: () => { order.push('focus') },
    }, 'data:text/html,loading')

    expect(order).toEqual(['load', 'show', 'focus'])
  })
})

describe('runDesktopBoot', () => {
  it('shows the loading window before reporting profile preparation failures', async () => {
    const order: string[] = []
    const startRuntime = vi.fn(async () => { order.push('runtime') })

    await runDesktopBoot({
      showLoadingWindow: async () => { order.push('window') },
      prepareProfile: async () => {
        order.push('profile')
        throw new Error('profile failed')
      },
      startRuntime,
      reportFailure: async (error) => {
        order.push(`failure:${error instanceof Error ? error.message : String(error)}`)
      },
    })

    expect(order).toEqual(['window', 'profile', 'failure:profile failed'])
    expect(startRuntime).not.toHaveBeenCalled()
  })

  it('reports failures that occur before a window can be created', async () => {
    const reportFailure = vi.fn(async () => undefined)

    await runDesktopBoot({
      showLoadingWindow: async () => { throw new Error('window failed') },
      prepareProfile: async () => undefined,
      startRuntime: async () => undefined,
      reportFailure,
    })

    expect(reportFailure).toHaveBeenCalledWith(expect.objectContaining({ message: 'window failed' }))
  })
})
