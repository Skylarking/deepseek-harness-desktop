import { createIcons, ExternalLink, FolderOpen, Plus, Power, Puzzle, RotateCcw, Trash2 } from 'lucide'
import type { DesktopManagedPlugin } from '../contracts.ts'
import { pluginLocale } from '../plugin-locale.ts'

function requiredElement(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector)
  if (element === null) throw new Error(`plugin manager: missing ${selector}`)
  return element
}

const pluginsElement = requiredElement('#plugins')
const skillsElement = requiredElement('#skills')
const packagesElement = requiredElement('#packages')
const skillsGroup = requiredElement('#skills-group')
const packagesGroup = requiredElement('#packages-group')
const emptyElement = requiredElement('#empty')
const summaryElement = requiredElement('#summary')
const noticeElement = requiredElement('#notice')
const pageTitleElement = requiredElement('#page-title')
const installedHeadingElement = requiredElement('#installed-heading')
const skillsHeadingElement = requiredElement('#skills-heading')
const packagesHeadingElement = requiredElement('#packages-heading')
const emptyTitleElement = requiredElement('#empty-title')
const emptyDescriptionElement = requiredElement('#empty-description')

const icons = { ExternalLink, FolderOpen, Plus, Power, Puzzle, RotateCcw, Trash2 }
let copy = pluginLocale('en')

const colorScheme = window.matchMedia('(prefers-color-scheme: dark)')

function syncTheme(): void {
  document.body.toggleAttribute('data-ds-dark-theme', colorScheme.matches)
}

syncTheme()
colorScheme.addEventListener('change', syncTheme)

function localizeButton(selector: string, label: string): void {
  const element = requiredElement(selector)
  element.title = label
  element.setAttribute('aria-label', label)
  const text = element.querySelector('span')
  if (text !== null) text.textContent = label
}

function applyLocale(): void {
  document.documentElement.lang = copy.language
  document.title = copy.windowTitle
  pageTitleElement.textContent = copy.title
  summaryElement.textContent = copy.loading
  installedHeadingElement.textContent = copy.plugins
  skillsHeadingElement.textContent = copy.skillPackages
  packagesHeadingElement.textContent = copy.otherPackages
  emptyTitleElement.textContent = copy.emptyTitle
  emptyDescriptionElement.textContent = copy.emptyDescription
  localizeButton('#open-profile', copy.openProfile)
  localizeButton('#restart', copy.restart)
  localizeButton('#install', copy.installLocal)
}

function renderIcons(): void {
  createIcons({ icons })
}

function setNotice(message: string, error = false): void {
  noticeElement.textContent = message
  noticeElement.classList.toggle('error', error)
}

function button(label: string, icon: string, className = ''): HTMLButtonElement {
  const element = document.createElement('button')
  element.className = className
  element.setAttribute('aria-label', label)
  element.title = label
  element.innerHTML = `<i data-lucide="${icon}"></i><span>${label}</span>`
  return element
}

function pluginRow(plugin: DesktopManagedPlugin): HTMLElement {
  const row = document.createElement('article')
  row.className = 'plugin'
  const details = document.createElement('div')
  details.className = 'plugin-details'
  const name = document.createElement('p')
  name.className = 'plugin-name'
  const nameText = document.createElement('span')
  nameText.textContent = plugin.name
  const status = document.createElement('span')
  status.className = `plugin-status plugin-status-${plugin.kind}`
  if (plugin.kind === 'bundle') status.dataset.enabled = plugin.enabled ? 'true' : 'false'
  status.textContent = plugin.kind === 'bundle'
    ? (plugin.enabled ? copy.enabled : copy.disabled)
    : plugin.kind === 'skill' ? copy.skill : copy.package
  name.append(nameText, status)
  const spec = document.createElement('p')
  spec.className = 'plugin-spec'
  spec.textContent = plugin.localPath ?? plugin.spec
  details.append(name, spec)
  const actions = document.createElement('div')
  actions.className = 'plugin-actions'
  if (plugin.localPath !== undefined) {
    const open = button(copy.openSource, 'external-link')
    open.addEventListener('click', () => { void window.dshDesktop.openSource(plugin.name) })
    actions.append(open)
  }
  if (plugin.kind === 'bundle') {
    const toggle = button(plugin.enabled ? copy.disable : copy.enable, 'power')
    toggle.addEventListener('click', () => {
      void (async () => {
        toggle.disabled = true
        try {
          const result = await window.dshDesktop.setEnabled(plugin.name, !plugin.enabled)
          setNotice(result.message)
          if (result.changed) await refresh()
        } catch (error) {
          setNotice(error instanceof Error ? error.message : String(error), true)
        } finally {
          toggle.disabled = false
        }
      })()
    })
    actions.append(toggle)
  }
  const remove = button(copy.remove, 'trash-2', 'danger')
  remove.addEventListener('click', () => {
    void (async () => {
      remove.disabled = true
      try {
        const result = await window.dshDesktop.remove(plugin.name)
        setNotice(result.message)
        if (result.changed) await refresh()
      } catch (error) {
        setNotice(error instanceof Error ? error.message : String(error), true)
      } finally {
        remove.disabled = false
      }
    })()
  })
  actions.append(remove)
  row.append(details, actions)
  return row
}

async function refresh(): Promise<void> {
  try {
    const installed = await window.dshDesktop.list()
    const plugins = installed.filter(item => item.kind === 'bundle')
    const skills = installed.filter(item => item.kind === 'skill')
    const packages = installed.filter(item => item.kind === 'package')
    pluginsElement.replaceChildren(...plugins.map(pluginRow))
    skillsElement.replaceChildren(...skills.map(pluginRow))
    packagesElement.replaceChildren(...packages.map(pluginRow))
    skillsGroup.hidden = skills.length === 0
    packagesGroup.hidden = packages.length === 0
    summaryElement.textContent = copy.summary(plugins.length, skills.length, packages.length)
    emptyElement.hidden = installed.length !== 0
    renderIcons()
  } catch (error) {
    setNotice(error instanceof Error ? error.message : String(error), true)
  }
}

document.querySelector('#install')?.addEventListener('click', () => {
  void (async () => {
    setNotice('')
    try {
      const result = await window.dshDesktop.installLocal()
      setNotice(result.message)
      if (result.changed) await refresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error), true)
    }
  })()
})
document.querySelector('#open-profile')?.addEventListener('click', () => { void window.dshDesktop.openProfile() })
document.querySelector('#restart')?.addEventListener('click', () => {
  void (async () => {
    setNotice(copy.restarting)
    try {
      await window.dshDesktop.restart()
      setNotice(copy.restarted)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error), true)
    }
  })()
})

void (async () => {
  copy = pluginLocale(await window.dshDesktop.locale())
  applyLocale()
  renderIcons()
  await refresh()
})()
