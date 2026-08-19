import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import type { PluginInventorySnapshot } from '@deepseek-ai/dsh-api-remotes/client'
import {
  IconChevronDownOutline14,
  IconSearchOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { PluginInventoryLocaleKey } from './locales.ts'
import css from './PluginInventorySettingsTab.module.css'

/** Registration-side Remote face used by the section. */
export interface PluginInventorySettingsTabInjected {
  /** Read a current Host inventory snapshot. */
  list: () => Promise<PluginInventorySnapshot>
  /** Desktop-only lifecycle operations; absent in browser deployments. */
  manager?: DesktopPluginManager
}

/** User-installed profile plugin projected by the Desktop host. */
export interface DesktopManagedPlugin {
  readonly name: string
  readonly spec: string
  readonly enabled: boolean
  readonly localPath?: string
}

/** Narrow Desktop lifecycle bridge available only in the packaged app. */
export interface DesktopPluginManager {
  installLocal: () => Promise<{ changed: boolean; message: string }>
  list: () => Promise<readonly DesktopManagedPlugin[]>
  remove: (name: string) => Promise<{ changed: boolean; message: string }>
  setEnabled: (name: string, enabled: boolean) => Promise<{ changed: boolean; message: string }>
}

type PluginInventoryEntry = PluginInventorySnapshot['entries'][number]
type PluginFiberPhase = PluginInventoryEntry['fiberPhase']

/** Full component props assembled by the Settings slot renderer. */
export type PluginInventorySettingsTabProps =
  PropsRuntime<'settings.plugins.tab'>
  & PropsLocale<'settings.pluginInventory'>
  & InjectFace<PluginInventorySettingsTabInjected>

type ViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly snapshot: PluginInventorySnapshot; readonly managed: readonly DesktopManagedPlugin[] }

const PHASE_KEYS = {
  pending: 'pending',
  loading: 'loadingPhase',
  active: 'active',
  failed: 'failed',
  unloading: 'unloading',
} satisfies Record<Exclude<PluginFiberPhase, null>, PluginInventoryLocaleKey>

/** Localized accessible label for one root Fiber phase. */
function phaseLabel(
  phase: PluginFiberPhase,
  t: PluginInventorySettingsTabProps['t'],
): string {
  return phase === null ? t('unobserved') : t(PHASE_KEYS[phase])
}

/** Compact a module specifier without guessing whether its Loader id was generated. */
function moduleShortName(moduleName: string): string {
  const unscoped = moduleName.startsWith('@') ? moduleName.slice(moduleName.indexOf('/') + 1) : moduleName
  return unscoped
    .replace(/^cordis:/, '')
    .replace(/^cordis-plugin-/, '')
    .replace(/^dsh-(?:host-|client-)?/, '')
}

/** Whether an inventory row matches the local catalog query. */
function matches(entry: PluginInventoryEntry, normalizedQuery: string): boolean {
  if (normalizedQuery.length === 0) return true
  return [entry.moduleName, entry.entryId]
    .some(value => value.toLocaleLowerCase().includes(normalizedQuery))
}

/** Render the read-only current Loader inventory. */
export function PluginInventorySettingsTab({ list, manager, t }: PluginInventorySettingsTabProps): ReactNode {
  const catalogId = useId()
  const [request, setRequest] = useState(0)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<PluginInventoryEntry['entryId'] | null>(null)
  const [state, setState] = useState<ViewState>({ status: 'loading' })
  const [managing, setManaging] = useState<string | null>(null)
  const [manageFailed, setManageFailed] = useState(false)

  useEffect(() => {
    let current = true
    void Promise.resolve().then(async () => await Promise.all([
      list(),
      manager?.list() ?? Promise.resolve([]),
    ])).then(
      ([snapshot, managed]) => { if (current) setState({ status: 'ready', snapshot, managed }) },
      () => { if (current) setState({ status: 'error' }) },
    )
    return () => { current = false }
  }, [list, request])

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredEntries = useMemo(
    () => state.status === 'ready'
      ? state.snapshot.entries.filter(entry => (
        !state.managed.some(plugin => plugin.name === entry.moduleName)
          && matches(entry, normalizedQuery)
      ))
      : [],
    [normalizedQuery, state],
  )
  const filteredManaged = useMemo(
    () => state.status === 'ready'
      ? state.managed.filter(plugin => normalizedQuery.length === 0
        || [plugin.name, plugin.spec, plugin.localPath ?? '']
          .some(value => value.toLocaleLowerCase().includes(normalizedQuery)))
      : [],
    [normalizedQuery, state],
  )
  const installedManaged = filteredManaged

  useEffect(() => {
    if (expanded !== null && !filteredEntries.some(entry => entry.entryId === expanded)) {
      setExpanded(null)
    }
  }, [expanded, filteredEntries])

  const retry = (): void => {
    setState({ status: 'loading' })
    setRequest(value => value + 1)
  }

  const mutate = (key: string, operation: () => Promise<{ changed: boolean; message: string }>): void => {
    setManaging(key)
    setManageFailed(false)
    void operation().then(
      (result) => {
        setManaging(null)
        if (result.changed) retry()
      },
      () => {
        setManaging(null)
        setManageFailed(true)
      },
    )
  }

  return (
    <div className={css.section} aria-busy={state.status === 'loading'}>
      {state.status === 'loading' ? <p className={css.status}>{t('loading')}</p> : null}
      {state.status === 'error' ? (
        <div className={css.failure}>
          <p role="alert">{t('error')}</p>
          <button type="button" onClick={retry}>{t('retry')}</button>
        </div>
      ) : null}
      {state.status === 'ready' ? (
        <div className={css.catalog}>
          <label className={css.search}>
            <IconSearchOutline16 aria-hidden="true" />
            <span className={css.visuallyHidden}>{t('search')}</span>
            <input
              type="search"
              value={query}
              placeholder={t('search')}
              aria-label={t('search')}
              onChange={(event) => { setQuery(event.currentTarget.value) }}
            />
          </label>
          {manager !== undefined ? (
            <section className={css.managedSection} aria-labelledby={`${catalogId}-installed`}>
              <div className={css.sectionHeading}>
                <div className={css.headingCopy}>
                  <h3 id={`${catalogId}-installed`}>{t('installedPlugins')}</h3>
                  <span>{installedManaged.length}</span>
                </div>
                <button
                  type="button"
                  className={css.installButton}
                  disabled={managing !== null}
                  onClick={() => { mutate('install', manager.installLocal) }}
                >
                  <span aria-hidden="true">+</span>
                  {t('installLocal')}
                </button>
              </div>
              {manageFailed ? <p className={css.manageError} role="alert">{t('manageFailed')}</p> : null}
              {managing !== null ? <p className={css.managing} role="status">{t('managing')}</p> : null}
              {state.managed.length === 0 ? <p className={css.status}>{t('installedEmpty')}</p> : null}
              {state.managed.length > 0 && installedManaged.length === 0
                ? <p className={css.status}>{t('emptySearch')}</p>
                : null}
              {installedManaged.length > 0 ? (
                <ul className={css.managedCards}>
                  {installedManaged.map(plugin => (
                    <li className={css.managedCard} key={plugin.name} data-managed-plugin={plugin.name}>
                      <div className={css.managedIdentity}>
                        <strong title={plugin.name}>{moduleShortName(plugin.name)}</strong>
                        <span title={plugin.localPath ?? plugin.spec}>
                          {plugin.localPath ?? plugin.spec}
                        </span>
                      </div>
                      <span className={css.configTag} data-enabled={plugin.enabled ? 'true' : 'false'}>
                        {t(plugin.enabled ? 'enabledTag' : 'disabledTag')}
                      </span>
                      <div className={css.managedActions}>
                        <button
                          type="button"
                          disabled={managing !== null}
                          onClick={() => {
                            mutate(`toggle:${plugin.name}`, async () => await manager.setEnabled(plugin.name, !plugin.enabled))
                          }}
                        >
                          {t(plugin.enabled ? 'disable' : 'enable')}
                        </button>
                        <button
                          type="button"
                          className={css.uninstallButton}
                          disabled={managing !== null}
                          onClick={() => { mutate(`remove:${plugin.name}`, async () => await manager.remove(plugin.name)) }}
                        >
                          {t('uninstall')}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}
          <div className={css.catalogHeading}>
            <h3>{t('systemComponents')}</h3>
            <span data-plugin-count={filteredEntries.length}>{filteredEntries.length}</span>
          </div>
          {state.snapshot.entries.length === 0 ? <p className={css.status}>{t('empty')}</p> : null}
          {state.snapshot.entries.length > 0 && filteredEntries.length === 0
            ? <p className={css.status}>{t('emptySearch')}</p>
            : null}
          {filteredEntries.length > 0 ? (
            <ul className={css.cards}>
              {filteredEntries.map((entry) => {
                const status = phaseLabel(entry.fiberPhase, t)
                const title = moduleShortName(entry.moduleName)
                const configuration = t(entry.enabled ? 'enabledTag' : 'disabledTag')
                const open = expanded === entry.entryId
                const detailId = `${catalogId}-details-${encodeURIComponent(entry.entryId)}`
                return (
                  <li
                    className={css.card}
                    key={entry.entryId}
                    data-plugin-entry={entry.entryId}
                    data-open={open ? 'true' : undefined}
                  >
                    <button
                      className={css.cardContent}
                      type="button"
                      aria-expanded={open}
                      aria-controls={detailId}
                      aria-label={entry.enabled ? `${title}, ${status}, ${configuration}` : `${title}, ${configuration}`}
                      onClick={() => {
                        setExpanded(current => current === entry.entryId ? null : entry.entryId)
                      }}
                    >
                      <strong className={css.cardTitle} title={entry.moduleName}>{title}</strong>
                      <span className={css.cardTrailing}>
                        {entry.enabled ? (
                          <span
                            className={css.statusDot}
                            data-phase={entry.fiberPhase ?? 'unobserved'}
                            role="img"
                            aria-label={status}
                            title={status}
                          />
                        ) : null}
                        <span className={css.configTag} data-enabled={entry.enabled ? 'true' : 'false'}>
                          {configuration}
                        </span>
                        <IconChevronDownOutline14 className={css.chevron} size={12} aria-hidden="true" />
                      </span>
                    </button>
                    {open ? (
                      <div className={css.cardDetails} id={detailId}>
                        <code className={css.entryValue} data-loader-entry>{entry.entryId}</code>
                        <dl className={css.details}>
                          <div>
                            <dt>{t('configuration')}</dt>
                            <dd>{configuration}</dd>
                          </div>
                          {entry.enabled ? (
                            <div>
                              <dt>{t('cordis')}</dt>
                              <dd>{status}</dd>
                            </div>
                          ) : null}
                        </dl>
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
