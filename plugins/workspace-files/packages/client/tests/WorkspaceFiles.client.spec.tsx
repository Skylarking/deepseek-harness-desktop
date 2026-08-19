// @vitest-environment jsdom

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceFilesPanel } from '../src/client/WorkspaceFiles.tsx'

const t = (key: string): string => key
const snapshot = {
  items: [{
    workspaceId: 'workspace-1',
    title: 'Project',
    path: '/work/project',
  }],
}

afterEach(cleanup)

describe('WorkspaceFilesPanel', () => {
  it('jumps to a workspace path and keeps the tree beside the preview', async () => {
    const list = vi.fn(async (_workspaceId: string, path: string) => path === ''
      ? {
        path: '',
        entries: [
          { name: 'src', path: 'src', kind: 'directory', ignored: false },
          { name: 'README.md', path: 'README.md', kind: 'file', ignored: false },
        ],
        truncated: false,
      }
      : {
        path: 'src',
        entries: [{ name: 'index.ts', path: 'src/index.ts', kind: 'file', ignored: false }],
        truncated: false,
      })
    const read = vi.fn(async () => ({ kind: 'text', path: 'README.md', content: '# Project' }))
    const view = render(<WorkspaceFilesPanel
      layout={{ toggleRightPanel() {} }}
      workspaces={{ getSnapshot: () => snapshot as never, subscribe: () => () => {} }}
      list={list as never}
      read={read as never}
      t={t as never}
      close={() => {}}
    />)

    await waitFor(() => { expect(view.getByRole('button', { name: 'src' })).toBeDefined() })
    const pathInput = view.getByRole('textbox', { name: 'path' })
    expect(pathInput.getAttribute('value')).toBe('/work/project')

    fireEvent.change(pathInput, { target: { value: '/work/project/src' } })
    fireEvent.submit(pathInput.closest('form') as HTMLFormElement)
    await waitFor(() => { expect(list).toHaveBeenCalledWith('workspace-1', 'src') })
    await waitFor(() => { expect(view.getByRole('button', { name: 'index.ts' })).toBeDefined() })

    const resizeHandle = view.getByRole('separator', { name: 'action.resizeTree' })
    Object.defineProperty(resizeHandle.parentElement, 'getBoundingClientRect', { value: () => ({ width: 320 }) })
    Object.defineProperty(resizeHandle.previousElementSibling, 'getBoundingClientRect', { value: () => ({ width: 140 }) })
    fireEvent.keyDown(resizeHandle, { key: 'ArrowRight' })
    expect(resizeHandle.parentElement?.getAttribute('style')).toContain('--workspace-tree-width: 156px')

    expect(view.queryByRole('button', { name: 'action.collapseAll' })).toBeNull()

    fireEvent.click(view.getByRole('button', { name: 'index.ts' }))
    await waitFor(() => { expect(view.getByText('# Project')).toBeDefined() })
    expect(read).toHaveBeenCalledWith('workspace-1', 'src/index.ts')
    expect(view.getByRole('button', { name: 'index.ts' })).toBeDefined()
    expect(view.queryByRole('button', { name: 'action.back' })).toBeNull()
  })
})
