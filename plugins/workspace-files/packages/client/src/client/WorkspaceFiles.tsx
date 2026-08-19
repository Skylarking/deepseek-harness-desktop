/** Two-column workspace file browser and its sidebar trigger. */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import {
  IconChevronDownOutline14, IconChevronRightOutline14, IconCloseOutline16,
  IconCodeOutline16, IconFolderClose16, IconFolderOpen16, IconPanelLeftOutline16, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { WorkspaceDirectoryListing, WorkspaceFileEntry, WorkspaceFilePreview } from '@deepseek-ai/dsh-host-workspace-files/types'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client'
import type { WorkspaceFilesKey } from './locales.ts'
import css from './WorkspaceFiles.module.css'

type Translate = (key: WorkspaceFilesKey) => string

const MIN_TREE_WIDTH = 96
const MIN_PREVIEW_WIDTH = 120
const TREE_RESIZE_STEP = 16

interface TreeResizeDrag {
  pointerId: number
  startX: number
  startWidth: number
  contentWidth: number
}

interface ContentStyle extends CSSProperties {
  '--workspace-tree-width'?: string
}

function clampTreeWidth(width: number, contentWidth: number): number {
  return Math.min(Math.max(width, MIN_TREE_WIDTH), Math.max(MIN_TREE_WIDTH, contentWidth - MIN_PREVIEW_WIDTH))
}

function joinWorkspacePath(root: string, relativePath: string): string {
  if (relativePath === '') return root
  const separator = root.includes('\\') ? '\\' : '/'
  return `${root.replace(/[\\/]+$/u, '')}${separator}${relativePath.replaceAll('/', separator)}`
}

function resolveWorkspaceRelativePath(input: string, root: string): string | undefined {
  const trimmed = input.trim()
  const normalizedRoot = root.replace(/[\\/]+$/u, '')
  let relativePath = trimmed
  if (trimmed === normalizedRoot || trimmed === '') relativePath = ''
  else if (trimmed.startsWith(`${normalizedRoot}/`) || trimmed.startsWith(`${normalizedRoot}\\`)) {
    relativePath = trimmed.slice(normalizedRoot.length + 1)
  } else if (/^(?:[A-Za-z]:[\\/]|[\\/])/u.test(trimmed)) return undefined
  const segments = relativePath.split(/[\\/]+/u).filter(segment => segment !== '' && segment !== '.')
  if (segments.includes('..')) return undefined
  return segments.join('/')
}

export interface WorkspaceFilesInjected {
  layout: { toggleRightPanel: () => void }
  workspaces: { getSnapshot: () => { items: readonly WorkspaceView[] }; subscribe: (listener: () => void) => () => void }
  list: (workspaceId: WorkspaceId, path: string) => Promise<WorkspaceDirectoryListing>
  read: (workspaceId: WorkspaceId, path: string) => Promise<WorkspaceFilePreview>
}

/** Conversation-header utility that toggles the right split panel. */
export function WorkspaceFilesTrigger({ layout, t }: WorkspaceFilesInjected & { t: Translate }) {
  return (
    <Tooltip label={t('action.open')} delayMs={500}>
      <button type="button" className={css.trigger} aria-label={t('action.open')} onClick={layout.toggleRightPanel}>
        <span className={css.rightPanelIcon}><IconPanelLeftOutline16 /></span>
      </button>
    </Tooltip>
  )
}

function FileRow({ entry, depth, expanded, selected, onOpen }: {
  entry: WorkspaceFileEntry
  depth: number
  expanded: boolean
  selected: boolean
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      className={css.fileRow}
      data-selected={selected || undefined}
      disabled={entry.ignored}
      style={{ paddingLeft: `${12 + depth * 16}px` }}
      title={entry.ignored ? entry.name : entry.path}
      onClick={onOpen}
    >
      <span className={css.disclosure}>
        {entry.kind === 'directory' && (expanded ? <IconChevronDownOutline14 /> : <IconChevronRightOutline14 />)}
      </span>
      {entry.kind === 'directory'
        ? (expanded ? <IconFolderOpen16 /> : <IconFolderClose16 />)
        : <IconCodeOutline16 />}
      <span className={css.fileName}>{entry.name}</span>
    </button>
  )
}

function Preview({ preview, pending, error, t }: {
  preview: WorkspaceFilePreview | undefined
  pending: boolean
  error: boolean
  t: Translate
}) {
  if (pending) return <div className={css.placeholder}>{t('loading')}</div>
  if (error) return <div className={css.placeholder}>{t('error.read')}</div>
  if (preview === undefined) return <div className={css.placeholder}>{t('empty.preview')}</div>
  if (preview.kind === 'text') return <pre className={css.textPreview}><code>{preview.content}</code></pre>
  if (preview.kind === 'image') {
    return <div className={css.imagePreview}><img src={`data:${preview.mimeType};base64,${preview.base64}`} alt={preview.path} /></div>
  }
  return <div className={css.placeholder}>{t(`unsupported.${preview.reason}`)}</div>
}

/** Right split panel containing workspace selection, directory tree, and preview. */
export function WorkspaceFilesPanel({ workspaces, list, read, t, close }: WorkspaceFilesInjected & { t: Translate; close: () => void }) {
  const workspaceItems = useSyncExternalStore(workspaces.subscribe, () => workspaces.getSnapshot().items)
  const [workspaceId, setWorkspaceId] = useState<WorkspaceId | undefined>()
  const [directories, setDirectories] = useState<Record<string, WorkspaceDirectoryListing>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['']))
  const [browsePath, setBrowsePath] = useState('')
  const [pathDraft, setPathDraft] = useState('')
  const [treeWidth, setTreeWidth] = useState<number>()
  const [treeDragging, setTreeDragging] = useState(false)
  const [selectedPath, setSelectedPath] = useState<string>()
  const [preview, setPreview] = useState<WorkspaceFilePreview>()
  const [listError, setListError] = useState(false)
  const [previewPending, setPreviewPending] = useState(false)
  const [previewError, setPreviewError] = useState(false)
  const resizeDrag = useRef<TreeResizeDrag | null>(null)

  useEffect(() => {
    if (workspaceId !== undefined && workspaceItems.some(item => item.workspaceId === workspaceId)) return
    setWorkspaceId(workspaceItems[0]?.workspaceId)
  }, [workspaceId, workspaceItems])

  useEffect(() => {
    setDirectories({})
    setExpanded(new Set(['']))
    setBrowsePath('')
    setPathDraft(workspaceItems.find(item => item.workspaceId === workspaceId)?.path ?? '')
    setTreeWidth(undefined)
    setSelectedPath(undefined)
    setPreview(undefined)
    setListError(false)
    if (workspaceId === undefined) return
    let current = true
    list(workspaceId, '').then((listing) => {
      if (current) setDirectories({ '': listing })
    }).catch(() => { if (current) setListError(true) })
    return () => { current = false }
  }, [list, workspaceId, workspaceItems])

  const rows = useMemo(() => {
    const output: Array<{ entry: WorkspaceFileEntry; depth: number }> = []
    const append = (path: string, depth: number): void => {
      for (const entry of directories[path]?.entries ?? []) {
        output.push({ entry, depth })
        if (entry.kind === 'directory' && expanded.has(entry.path)) append(entry.path, depth + 1)
      }
    }
    append(browsePath, 0)
    return output
  }, [browsePath, directories, expanded])

  const openEntry = (entry: WorkspaceFileEntry): void => {
    if (workspaceId === undefined) return
    if (entry.kind === 'directory') {
      const next = new Set(expanded)
      if (next.has(entry.path)) next.delete(entry.path)
      else {
        next.add(entry.path)
        if (directories[entry.path] === undefined) {
          list(workspaceId, entry.path).then((listing) => {
            setDirectories(value => ({ ...value, [entry.path]: listing }))
          }).catch(() => { setListError(true) })
        }
      }
      setExpanded(next)
      return
    }
    setSelectedPath(entry.path)
    setPreview(undefined)
    setPreviewError(false)
    setPreviewPending(true)
    read(workspaceId, entry.path).then(setPreview).catch(() => { setPreviewError(true) }).finally(() => { setPreviewPending(false) })
  }

  const selectedWorkspace = workspaceItems.find(item => item.workspaceId === workspaceId)
  const selectedName = selectedPath?.split('/').at(-1) ?? selectedPath
  const submitPath = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (workspaceId === undefined || selectedWorkspace === undefined) return
    const target = resolveWorkspaceRelativePath(pathDraft, selectedWorkspace.path)
    if (target === undefined) {
      setListError(true)
      return
    }
    setListError(false)
    list(workspaceId, target).then((listing) => {
      setDirectories({ [target]: listing })
      setExpanded(new Set([target]))
      setBrowsePath(target)
      setPathDraft(joinWorkspacePath(selectedWorkspace.path, target))
      setSelectedPath(undefined)
      setPreview(undefined)
      setPreviewError(false)
      setPreviewPending(false)
    }).catch(() => { setListError(true) })
  }
  return (
    <section className={css.panel} aria-label={t('title')}>
      <header className={css.header}>
        <form className={css.pathBar} onSubmit={submitPath}>
          <IconFolderOpen16 />
          <input
            value={pathDraft}
            aria-label={t('path')}
            title={pathDraft}
            spellCheck={false}
            onChange={(event) => { setPathDraft(event.target.value) }}
            onBlur={() => { setPathDraft(joinWorkspacePath(selectedWorkspace?.path ?? '', browsePath)) }}
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return
              setPathDraft(joinWorkspacePath(selectedWorkspace?.path ?? '', browsePath))
              event.currentTarget.blur()
            }}
          />
        </form>
        <div className={css.headerActions}>
          <select
            value={workspaceId ?? ''}
            aria-label={t('workspace')}
            title={selectedWorkspace?.path}
            onChange={(event) => { setWorkspaceId(event.target.value as WorkspaceId) }}
          >
            {workspaceItems.map(workspace => (
              <option key={workspace.workspaceId} value={workspace.workspaceId}>{workspace.title}</option>
            ))}
          </select>
          <button type="button" className={css.close} aria-label={t('action.close')} onClick={close}><IconCloseOutline16 /></button>
        </div>
      </header>
      {workspaceItems.length === 0
        ? <div className={css.placeholder}>{t('empty.workspaces')}</div>
        : (
          <div
            className={css.content}
            style={treeWidth === undefined ? undefined : { '--workspace-tree-width': `${treeWidth}px` } as ContentStyle}
          >
            <aside className={css.tree} aria-label={t('title')}>
              {listError && <div className={css.treeNotice}>{t('error.list')}</div>}
              {rows.map(({ entry, depth }) => (
                <FileRow
                  key={entry.path}
                  entry={entry}
                  depth={depth}
                  expanded={expanded.has(entry.path)}
                  selected={selectedPath === entry.path}
                  onOpen={() => { openEntry(entry) }}
                />
              ))}
              {directories[browsePath]?.entries.length === 0 && <div className={css.treeNotice}>{t('empty.directory')}</div>}
              {Object.values(directories).some(directory => directory.truncated) && <div className={css.treeNotice}>{t('truncated')}</div>}
            </aside>
            <div
              className={css.treeResizeHandle}
              role="separator"
              aria-label={t('action.resizeTree')}
              aria-orientation="vertical"
              data-dragging={treeDragging || undefined}
              tabIndex={0}
              title={t('action.resizeTree')}
              onDoubleClick={() => { setTreeWidth(undefined) }}
              onPointerDown={(event) => {
                if (event.button !== 0) return
                const content = event.currentTarget.parentElement
                const tree = event.currentTarget.previousElementSibling
                if (content === null || !(tree instanceof HTMLElement)) return
                resizeDrag.current = {
                  pointerId: event.pointerId,
                  startX: event.clientX,
                  startWidth: tree.getBoundingClientRect().width,
                  contentWidth: content.getBoundingClientRect().width,
                }
                setTreeDragging(true)
                event.currentTarget.setPointerCapture(event.pointerId)
                event.preventDefault()
              }}
              onPointerMove={(event) => {
                const drag = resizeDrag.current
                if (drag === null || drag.pointerId !== event.pointerId) return
                setTreeWidth(clampTreeWidth(drag.startWidth + event.clientX - drag.startX, drag.contentWidth))
              }}
              onPointerUp={(event) => {
                if (resizeDrag.current?.pointerId !== event.pointerId) return
                resizeDrag.current = null
                setTreeDragging(false)
                event.currentTarget.releasePointerCapture(event.pointerId)
              }}
              onPointerCancel={() => {
                resizeDrag.current = null
                setTreeDragging(false)
              }}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
                const content = event.currentTarget.parentElement
                const tree = event.currentTarget.previousElementSibling
                if (content === null || !(tree instanceof HTMLElement)) return
                const direction = event.key === 'ArrowLeft' ? -1 : 1
                setTreeWidth(clampTreeWidth(
                  tree.getBoundingClientRect().width + direction * TREE_RESIZE_STEP,
                  content.getBoundingClientRect().width,
                ))
                event.preventDefault()
              }}
            />
            <main className={css.preview}>
              {selectedPath !== undefined && (
                <div className={css.previewHeader}>
                  <IconCodeOutline16 />
                  <div>
                    <strong>{selectedName}</strong>
                    <span title={selectedPath}>{selectedPath}</span>
                  </div>
                </div>
              )}
              <Preview preview={preview} pending={previewPending} error={previewError} t={t} />
            </main>
          </div>
        )}
    </section>
  )
}
