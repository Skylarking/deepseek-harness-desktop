import { createIcons, ExternalLink, FolderOpen, Plus, Power, Puzzle, RotateCcw, Trash2 } from 'lucide'
import type { DesktopManagedPlugin } from '../contracts.ts'

function requiredElement(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector)
  if (element === null) throw new Error(`plugin manager: missing ${selector}`)
  return element
}

const pluginsElement = requiredElement('#plugins')
const emptyElement = requiredElement('#empty')
const summaryElement = requiredElement('#summary')
const noticeElement = requiredElement('#notice')

const icons = { ExternalLink, FolderOpen, Plus, Power, Puzzle, RotateCcw, Trash2 }

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
  const icon = document.createElement('div')
  icon.className = 'plugin-icon'
  icon.innerHTML = '<i data-lucide="puzzle"></i>'
  const details = document.createElement('div')
  details.className = 'plugin-details'
  const name = document.createElement('p')
  name.className = 'plugin-name'
  name.textContent = plugin.name
  const spec = document.createElement('p')
  spec.className = 'plugin-spec'
  spec.textContent = plugin.localPath ?? plugin.spec
  details.append(name, spec)
  const actions = document.createElement('div')
  actions.className = 'plugin-actions'
  if (plugin.localPath !== undefined) {
    const open = button('Open Source', 'external-link')
    open.addEventListener('click', () => { void window.dshDesktop.openSource(plugin.name) })
    actions.append(open)
  }
  const toggle = button(plugin.enabled ? 'Disable' : 'Enable', 'power')
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
  const remove = button('Remove', 'trash-2', 'danger')
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
  row.append(icon, details, actions)
  return row
}

async function refresh(): Promise<void> {
  try {
    const plugins = await window.dshDesktop.list()
    pluginsElement.replaceChildren(...plugins.map(pluginRow))
    summaryElement.textContent = `${String(plugins.length)} installed plugin${plugins.length === 1 ? '' : 's'} in the Web profile`
    emptyElement.hidden = plugins.length !== 0
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
    setNotice('Restarting DSH...')
    try {
      await window.dshDesktop.restart()
      setNotice('DSH restarted')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error), true)
    }
  })()
})

renderIcons()
void refresh()
