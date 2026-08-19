/** Sidebar terminal trigger and bottom-docked persistent PTY. */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { IconCloseOutline16, IconCodeOutline16, IconPanelLeftOutline16, IconPlusOutline16, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  WorkspaceConsoleReadResult,
  WorkspaceConsoleSessionId,
} from '@deepseek-ai/dsh-host-workspace-console/types'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client'
import type { WorkspaceConsoleKey } from './locales.ts'
import css from './WorkspaceConsole.module.css'

type Translate = (key: WorkspaceConsoleKey, vars?: Record<string, string | number>) => string

interface WorkspaceConsoleRemote {
  open(workspaceId: WorkspaceId, cols: number, rows: number): Promise<WorkspaceConsoleSessionId>
  write(sessionId: WorkspaceConsoleSessionId, data: string): Promise<void>
  read(sessionId: WorkspaceConsoleSessionId, offset: number): Promise<WorkspaceConsoleReadResult>
  resize(sessionId: WorkspaceConsoleSessionId, cols: number, rows: number): Promise<void>
  close(sessionId: WorkspaceConsoleSessionId): Promise<void>
}

export interface WorkspaceConsoleInjected {
  layout: { toggleBottomPanel: () => void }
  workspaces: { getSnapshot: () => { items: readonly WorkspaceView[] }; subscribe: (listener: () => void) => () => void }
  terminal: WorkspaceConsoleRemote
}

/** Conversation utility that toggles the bottom split panel. */
export function WorkspaceConsoleTrigger({ layout, t }: WorkspaceConsoleInjected & { t: Translate }) {
  return <Tooltip label={t('action.open')} delayMs={500}><button type="button" className={css.trigger} aria-label={t('action.open')} onClick={layout.toggleBottomPanel}><span className={css.bottomPanelIcon}><IconPanelLeftOutline16 /></span></button></Tooltip>
}

function cssColor(element: HTMLElement, name: string, fallback: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim() || fallback
}

function xterm(element: HTMLElement): { terminal: Terminal; fit: FitAddon } {
  const terminal = new Terminal({
    allowProposedApi: false,
    convertEol: false,
    cursorBlink: true,
    fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: 12,
    lineHeight: 1.3,
    scrollback: 10_000,
    theme: {
      background: cssColor(element, '--dsw-alias-bg-base', '#ffffff'),
      foreground: cssColor(element, '--dsw-alias-label-primary', '#171717'),
      cursor: cssColor(element, '--dsw-alias-label-primary', '#171717'),
      cursorAccent: cssColor(element, '--dsw-alias-bg-base', '#ffffff'),
      selectionBackground: cssColor(element, '--dsw-alias-interactive-bg-selected', '#dbeafe'),
    },
  })
  const fit = new FitAddon()
  terminal.loadAddon(fit)
  terminal.open(element)
  fit.fit()
  return { terminal, fit }
}

interface TerminalViewportProps {
  active: boolean
  workspaceId: WorkspaceId
  remote: WorkspaceConsoleRemote
  t: Translate
}

function TerminalViewport({ active, workspaceId, remote, t }: TerminalViewportProps) {
  const elementRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<ReturnType<typeof xterm>>()
  const translateRef = useRef(t)
  translateRef.current = t

  useEffect(() => {
    const element = elementRef.current
    if (element === null) return
    const lifecycle = new AbortController()
    let sessionId: WorkspaceConsoleSessionId | undefined
    let offset = 0
    let pollTimer: ReturnType<typeof setTimeout> | undefined
    let writeQueue = Promise.resolve()
    const view = xterm(element)
    viewRef.current = view

    const report = (error: unknown): void => {
      if (lifecycle.signal.aborted) return
      const message = error instanceof Error ? error.message : String(error)
      view.terminal.write(`\r\n\x1b[31m${translateRef.current('error')}: ${message}\x1b[0m\r\n`)
    }

    const poll = async (): Promise<void> => {
      if (lifecycle.signal.aborted || sessionId === undefined) return
      try {
        const result = await remote.read(sessionId, offset)
        // React cleanup may abort this lifecycle while the Remote read is in flight.
        if (lifecycle.signal.aborted) return
        offset = result.nextOffset
        if (result.lossy) view.terminal.write(`\r\n\x1b[33m${translateRef.current('truncated')}\x1b[0m\r\n`)
        if (result.text !== '') view.terminal.write(result.text)
        if (!result.exited) pollTimer = setTimeout(() => { void poll() }, 40)
      } catch (error: unknown) {
        report(error)
      }
    }

    const data = view.terminal.onData((value) => {
      const opened = sessionId
      if (opened === undefined) return
      writeQueue = writeQueue.then(() => remote.write(opened, value)).catch(report)
    })
    const resize = view.terminal.onResize(({ cols, rows }) => {
      if (sessionId !== undefined) void remote.resize(sessionId, cols, rows).catch(report)
    })
    const observer = new ResizeObserver(() => { view.fit.fit() })
    observer.observe(element)

    void remote.open(workspaceId, view.terminal.cols, view.terminal.rows).then((opened) => {
      if (lifecycle.signal.aborted) {
        void remote.close(opened)
        return
      }
      sessionId = opened
      if (active) view.terminal.focus()
      void poll()
    }).catch(report)

    return () => {
      lifecycle.abort()
      if (pollTimer !== undefined) clearTimeout(pollTimer)
      observer.disconnect()
      data.dispose()
      resize.dispose()
      view.terminal.dispose()
      viewRef.current = undefined
      if (sessionId !== undefined) {
        const opened = sessionId
        void writeQueue.then(() => remote.close(opened))
      }
    }
  }, [remote, workspaceId]) // active visibility must not restart the PTY

  useEffect(() => {
    if (!active) return
    viewRef.current?.fit.fit()
    viewRef.current?.terminal.focus()
  }, [active])

  return <div ref={elementRef} className={css.terminal} onMouseDown={() => { elementRef.current?.querySelector<HTMLTextAreaElement>('.xterm-helper-textarea')?.focus() }} />
}

interface ConsoleTab {
  readonly id: number
  readonly workspaceId: WorkspaceId
}

/** Bottom-docked interactive terminal panel. */
export function WorkspaceConsolePanel({ workspaces, terminal, t, close }: WorkspaceConsoleInjected & { t: Translate; close: () => void }) {
  const items = useSyncExternalStore(workspaces.subscribe, () => workspaces.getSnapshot().items)
  const nextTabId = useRef(1)
  const [tabs, setTabs] = useState<readonly ConsoleTab[]>([])
  const [activeTabId, setActiveTabId] = useState<number | undefined>()

  useEffect(() => {
    setTabs((current) => {
      const fallback = items[0]?.workspaceId
      if (fallback === undefined) return []
      if (current.length === 0) return [{ id: nextTabId.current++, workspaceId: fallback }]
      return current.map(tab => items.some(item => item.workspaceId === tab.workspaceId)
        ? tab
        : { ...tab, workspaceId: fallback })
    })
  }, [items])

  const selectedTabId = tabs.some(tab => tab.id === activeTabId) ? activeTabId : tabs[0]?.id

  const addTab = (): void => {
    const source = tabs.find(tab => tab.id === selectedTabId) ?? tabs[0]
    if (source === undefined) return
    const tab = { id: nextTabId.current++, workspaceId: source.workspaceId }
    setTabs(current => [...current, tab])
    setActiveTabId(tab.id)
  }

  const closeTab = (id: number): void => {
    if (tabs.length === 1) {
      close()
      return
    }
    const index = tabs.findIndex(tab => tab.id === id)
    const remaining = tabs.filter(tab => tab.id !== id)
    setTabs(remaining)
    if (selectedTabId === id) setActiveTabId(remaining[index]?.id ?? remaining[index - 1]?.id)
  }

  const setWorkspace = (id: number, workspaceId: WorkspaceId): void => {
    setActiveTabId(id)
    setTabs(current => current.map(tab => tab.id === id ? { ...tab, workspaceId } : tab))
  }

  return (
    <section className={css.panel} aria-label={t('title')}>
      <header className={css.tabBar}>
        <div className={css.tabs}>
          {tabs.map(tab => (
            <label key={tab.id} className={css.tab} data-active={tab.id === selectedTabId} onMouseDown={() => { setActiveTabId(tab.id) }}>
              <IconCodeOutline16 size={14} />
              <span className={css.srOnly}>{t('workspace')}</span>
              <select value={tab.workspaceId} aria-label={t('workspace')} onChange={(event) => { setWorkspace(tab.id, event.target.value as WorkspaceId) }}>
                {items.map(item => <option key={item.workspaceId} value={item.workspaceId}>{item.title}</option>)}
              </select>
              <button type="button" className={css.tabClose} aria-label={t('action.closeTab')} onClick={(event) => { event.preventDefault(); closeTab(tab.id) }}><IconCloseOutline16 size={13} /></button>
            </label>
          ))}
          <Tooltip label={t('action.new')} delayMs={500}><button type="button" className={css.add} aria-label={t('action.new')} disabled={tabs.length === 0} onClick={addTab}><IconPlusOutline16 /></button></Tooltip>
        </div>
        <button type="button" className={css.close} aria-label={t('action.close')} onClick={close}><IconCloseOutline16 /></button>
      </header>
      {tabs.length === 0
        ? <div className={css.empty}>{t('noWorkspace')}</div>
        : <div className={css.terminals}>{tabs.map(tab => (
          <div key={tab.id} className={css.terminalPane} hidden={tab.id !== selectedTabId}>
            <TerminalViewport
              active={tab.id === selectedTabId}
              workspaceId={tab.workspaceId}
              remote={terminal}
              t={t}
            />
          </div>
        ))}</div>}
    </section>
  )
}
