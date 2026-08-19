import { describe, expect, it } from 'vitest'
import { pluginWindowOptions } from '../src/plugin-window.ts'

describe('plugin manager window', () => {
  it('opens as a compact native child with macOS window controls but no fullscreen', () => {
    const parent = { id: 'main-window' }
    const options = pluginWindowOptions(parent, '/app/preload.cjs')

    expect(options).toMatchObject({
      parent,
      modal: false,
      show: false,
      width: 720,
      height: 560,
      closable: true,
      minimizable: false,
      maximizable: true,
      fullscreenable: false,
    })
  })
})
