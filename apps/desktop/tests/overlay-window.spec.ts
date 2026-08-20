import { describe, expect, it } from 'vitest'
import {
  configureOverlayWindow,
  destroyOverlayWindow,
  overlayExpandedBounds,
  overlayWindowOptions,
} from '../src/overlay-window.ts'

describe('desktop overlay window', () => {
  it('loads the narrow preload bridge in an isolated transparent window', () => {
    const options = overlayWindowOptions(
      { entry: 'dsh:web', width: 164, height: 164 },
      { x: 0, y: 25, width: 1512, height: 957 },
      '/app/overlay-preload.cjs',
      'darwin',
    )

    expect(options).toMatchObject({
      x: 1324,
      y: 794,
      width: 164,
      height: 164,
      type: 'panel',
      acceptFirstMouse: true,
      hiddenInMissionControl: true,
      transparent: true,
      alwaysOnTop: true,
      webPreferences: {
        preload: '/app/overlay-preload.cjs',
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
  })

  it('keeps the macOS panel above apps, Spaces, and full-screen windows', () => {
    const calls: unknown[][] = []
    const window = {
      setAlwaysOnTop: (...args: unknown[]) => calls.push(['setAlwaysOnTop', ...args]),
      setVisibleOnAllWorkspaces: (...args: unknown[]) => calls.push(['setVisibleOnAllWorkspaces', ...args]),
    }

    configureOverlayWindow(window, 'darwin')

    expect(calls).toEqual([
      ['setVisibleOnAllWorkspaces', true, { visibleOnFullScreen: true, skipTransformProcessType: true }],
      ['setAlwaysOnTop', true, 'floating'],
    ])
  })

  it('does not apply the macOS panel type or Space behavior on other platforms', () => {
    const options = overlayWindowOptions(
      { entry: 'dsh:web', width: 164, height: 164 },
      { x: 0, y: 0, width: 1280, height: 720 },
      '/app/overlay-preload.cjs',
      'win32',
    )
    const calls: unknown[][] = []

    configureOverlayWindow({
      setAlwaysOnTop: (...args: unknown[]) => calls.push(['setAlwaysOnTop', ...args]),
      setVisibleOnAllWorkspaces: (...args: unknown[]) => calls.push(['setVisibleOnAllWorkspaces', ...args]),
    }, 'win32')

    expect(options.type).toBeUndefined()
    expect(options.hiddenInMissionControl).toBeUndefined()
    expect(calls).toEqual([['setAlwaysOnTop', true, 'floating']])
  })

  it('force-destroys a live overlay before its runtime is replaced', () => {
    let destroyCalls = 0
    const window = {
      destroy: () => { destroyCalls += 1 },
      isDestroyed: () => destroyCalls > 0,
    }

    destroyOverlayWindow(window)
    destroyOverlayWindow(window)

    expect(destroyCalls).toBe(1)
  })

  it('uses plugin-owned sizes and preserves the bottom-right anchor', () => {
    const overlay = {
      entry: 'dsh:web',
      width: 164,
      height: 164,
      expandedWidth: 360,
      expandedHeight: 520,
    }

    const expanded = overlayExpandedBounds({ x: 1324, y: 794, width: 164, height: 164 }, overlay, true)
    expect(expanded).toEqual({ x: 1128, y: 438, width: 360, height: 520 })
    expect(overlayExpandedBounds(expanded, overlay, false)).toEqual({ x: 1324, y: 794, width: 164, height: 164 })

    const scaled = overlayExpandedBounds(
      { x: 1324, y: 794, width: 164, height: 164 },
      overlay,
      false,
      { width: 246, height: 246 },
    )
    expect(scaled).toEqual({ x: 1242, y: 712, width: 246, height: 246 })
    expect(overlayExpandedBounds(scaled, overlay, true, { width: 246, height: 246 }))
      .toEqual({ x: 1128, y: 438, width: 360, height: 520 })
  })
})
