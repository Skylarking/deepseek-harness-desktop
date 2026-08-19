// @vitest-environment jsdom

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceConsolePanel } from '../src/client/WorkspaceConsole.tsx'

const xterm = vi.hoisted(() => ({ instances: [] as Array<{
  data(value: string): void
  resize(cols: number, rows: number): void
  focused: boolean
  disposed: boolean
  output: string[]
}>, fit: vi.fn() }))

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    fit = xterm.fit
  },
}))

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    cols = 80
    rows = 24
    focused = false
    disposed = false
    output: string[] = []
    private dataListener: ((value: string) => void) | undefined
    private resizeListener: ((size: { cols: number; rows: number }) => void) | undefined
    constructor() { xterm.instances.push(this) }
    loadAddon() {}
    open(element: HTMLElement) {
      const input = document.createElement('textarea')
      input.className = 'xterm-helper-textarea'
      element.append(input)
    }
    focus() { this.focused = true }
    write(value: string) { this.output.push(value) }
    onData(listener: (value: string) => void) { this.dataListener = listener; return { dispose: vi.fn() } }
    onResize(listener: (size: { cols: number; rows: number }) => void) { this.resizeListener = listener; return { dispose: vi.fn() } }
    data(value: string) { this.dataListener?.(value) }
    resize(cols: number, rows: number) { this.resizeListener?.({ cols, rows }) }
    dispose() { this.disposed = true }
  },
}))

class TestResizeObserver {
  observe() {}
  disconnect() {}
}

const t = (key: string): string => key
const snapshot = { items: [{ workspaceId: 'workspace-1', title: 'Project' }] }

beforeEach(() => {
  xterm.instances.length = 0
  xterm.fit.mockClear()
  vi.stubGlobal('ResizeObserver', TestResizeObserver)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('WorkspaceConsolePanel', () => {
  it('opens a focused terminal, forwards ordered raw input and resize, and closes it on unmount', async () => {
    let releaseFirstWrite: (() => void) | undefined
    const firstWrite = new Promise<void>((resolve) => { releaseFirstWrite = resolve })
    const remote = {
      open: vi.fn(async () => 'terminal-1'),
      write: vi.fn()
        .mockReturnValueOnce(firstWrite)
        .mockResolvedValue(undefined),
      read: vi.fn(async () => ({ text: 'ready% ', nextOffset: 7, lossy: false, exited: true, exitCode: 0, signal: null })),
      resize: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
    }
    const view = render(<WorkspaceConsolePanel
      layout={{ toggleBottomPanel() {} }}
      workspaces={{ getSnapshot: () => snapshot as never, subscribe: () => () => {} }}
      terminal={remote as never}
      t={t as never}
      close={() => {}}
    />)

    await waitFor(() => { expect(remote.open).toHaveBeenCalledWith('workspace-1', 80, 24) })
    const terminal = xterm.instances[0]!
    expect(terminal.focused).toBe(true)
    terminal.data('pw')
    terminal.data('d\r')
    await waitFor(() => { expect(remote.write).toHaveBeenCalledTimes(1) })
    expect(remote.write).toHaveBeenLastCalledWith('terminal-1', 'pw')
    releaseFirstWrite?.()
    await waitFor(() => { expect(remote.write).toHaveBeenLastCalledWith('terminal-1', 'd\r') })
    terminal.resize(120, 40)
    await waitFor(() => { expect(remote.resize).toHaveBeenCalledWith('terminal-1', 120, 40) })
    await waitFor(() => { expect(terminal.output).toContain('ready% ') })

    const textarea = view.container.querySelector<HTMLTextAreaElement>('.xterm-helper-textarea')!
    fireEvent.mouseDown(textarea.parentElement!)
    expect(document.activeElement).toBe(textarea)
    view.unmount()
    expect(terminal.disposed).toBe(true)
    await waitFor(() => { expect(remote.close).toHaveBeenCalledWith('terminal-1') })
  })

  it('keeps independent PTYs alive across tab switches and closes only the removed tab', async () => {
    const remote = {
      open: vi.fn()
        .mockResolvedValueOnce('terminal-1')
        .mockResolvedValueOnce('terminal-2'),
      write: vi.fn(async () => {}),
      read: vi.fn(async () => ({ text: '', nextOffset: 0, lossy: false, exited: true, exitCode: 0, signal: null })),
      resize: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
    }
    const view = render(<WorkspaceConsolePanel
      layout={{ toggleBottomPanel() {} }}
      workspaces={{ getSnapshot: () => snapshot as never, subscribe: () => () => {} }}
      terminal={remote as never}
      t={t as never}
      close={() => {}}
    />)

    await waitFor(() => { expect(remote.open).toHaveBeenCalledTimes(1) })
    fireEvent.click(view.getByRole('button', { name: 'action.new' }))
    await waitFor(() => { expect(remote.open).toHaveBeenCalledTimes(2) })
    expect(xterm.instances).toHaveLength(2)
    expect(xterm.instances[0]!.disposed).toBe(false)

    const closeTabs = view.getAllByRole('button', { name: 'action.closeTab' })
    fireEvent.click(closeTabs[1]!)
    await waitFor(() => { expect(remote.close).toHaveBeenCalledWith('terminal-2') })
    expect(xterm.instances[1]!.disposed).toBe(true)
    expect(xterm.instances[0]!.disposed).toBe(false)

    view.unmount()
    await waitFor(() => { expect(remote.close).toHaveBeenCalledWith('terminal-1') })
  })
})
