/**
 * Electron host for the official DSH Web UI. The renderer remains unprivileged;
 * DSH and profile mutations run in owned child processes behind narrow IPC handlers.
 */
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  screen,
  shell,
  type IpcMainInvokeEvent,
  type MenuItemConstructorOptions,
} from 'electron'
import type { DesktopPlugin, PluginMutationResult } from './contracts.ts'
import { revealLoadingWindow, runDesktopBoot } from './desktop-boot.ts'
import { DshProcess, resolveDshEntry } from './dsh-process.ts'
import {
  configureOverlayWindow,
  destroyOverlayWindow,
  overlayExpandedBounds,
  overlayWindowOptions,
} from './overlay-window.ts'
import { pluginLocale } from './plugin-locale.ts'
import { pluginWindowOptions } from './plugin-window.ts'
import {
  cleanupPluginSettings, cleanupProfilePluginLink, listProfilePlugins,
  removeRetiredDesktopDefaults, resolveSettingsFile, resolveWebProfileDir,
  runPluginCommand, setProfilePluginEnabled, syncProfileSupportPackages,
} from './plugin-manager.ts'
import { RuntimeOperationQueue } from './runtime-operation-queue.ts'
import { isTrustedRendererFrame, isTrustedRuntimeFrame } from './window-security.ts'

const APP_NAME = 'DeepSeek Harness'
const DESKTOP_HOST_MARKER = 'dsh:desktop-host'
const PLUGIN_MANAGER_URL = pathToFileURL(join(import.meta.dirname, 'renderer', 'plugins.html')).href
const DESKTOP_PLUGIN_INVENTORY = '@skylarking/dsh-client-ui-desktop-plugin-inventory'

let mainWindow: BrowserWindow | undefined
let pluginWindow: BrowserWindow | undefined
const desktopWindows = new Map<string, BrowserWindow>()
const desktopWindowPlugins = new Map<BrowserWindow, DesktopPlugin>()
const desktopWindowCompactSizes = new Map<BrowserWindow, { width: number; height: number }>()
const desktopWindowExpanded = new Map<BrowserWindow, boolean>()
let runtime: DshProcess | undefined
let runtimeUrl: string | undefined
let runtimeEntry: string
let workspace = process.env.DSH_DESKTOP_WORKSPACE ?? homedir()
const runtimeOperations = new RuntimeOperationQueue()
let quitting = false

interface ProfileBootModule {
  initProfile: (profileDir: string, bundles: readonly string[]) => void
  PROFILE_TEMPLATES: Record<string, readonly string[]>
}

/** Initialize the Web profile through the staged runtime's built app-boot package. */
async function initializeWebProfile(profileDir: string): Promise<void> {
  const runtimeRoot = dirname(dirname(runtimeEntry))
  const modulePath = join(runtimeRoot, 'node_modules', '@deepseek-ai', 'dsh-app-boot', 'lib', 'index.js')
  const profileBoot = await import(pathToFileURL(modulePath).href) as ProfileBootModule
  const bundles = profileBoot.PROFILE_TEMPLATES.web
  if (bundles === undefined) throw new Error('The staged DSH runtime does not define the Web profile')
  profileBoot.initProfile(profileDir, bundles)
}

function desktopPatchPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'desktop.patch.yml')
    : fileURLToPath(new URL('../desktop.patch.yml', import.meta.url))
}

function requiredDesktopSupportPackages(): Record<string, string> {
  const runtimeRoot = dirname(dirname(runtimeEntry))
  return {
    [DESKTOP_PLUGIN_INVENTORY]: join(runtimeRoot, 'node_modules', ...DESKTOP_PLUGIN_INVENTORY.split('/')),
  }
}

function loadingPage(message: string): string {
  const escaped = message.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  return `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8"><style>body{background:#f7f8fa;color:#25282d;display:grid;font-family:-apple-system,BlinkMacSystemFont,sans-serif;margin:0;min-height:100vh;place-items:center}main{text-align:center}h1{font-size:18px;font-weight:600;letter-spacing:0;margin:0 0 8px}p{color:#6c727c;font-size:13px;letter-spacing:0;margin:0}</style></head><body><main><h1>${APP_NAME}</h1><p>${escaped}</p></main></body></html>`)} `
}

function currentOrigin(): string | undefined {
  if (runtimeUrl === undefined) return undefined
  return new URL(runtimeUrl).origin
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 900,
    minHeight: 620,
    show: false,
    title: APP_NAME,
    backgroundColor: '#f7f8fa',
    webPreferences: {
      preload: join(import.meta.dirname, 'web-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    const origin = currentOrigin()
    if (origin !== undefined && new URL(url).origin === origin) return
    event.preventDefault()
    if (url.startsWith('https://') || url.startsWith('http://')) void shell.openExternal(url)
  })
  window.on('closed', () => {
    mainWindow = undefined
    if (!quitting) app.quit()
  })
  return window
}

function showDesktopOverlay(plugin: DesktopPlugin): void {
  const overlay = plugin.desktopOverlay
  if (overlay === undefined) return
  const existing = desktopWindows.get(plugin.name)
  if (existing !== undefined && !existing.isDestroyed()) {
    existing.showInactive()
    return
  }
  const workArea = mainWindow === undefined
    ? screen.getPrimaryDisplay().workArea
    : screen.getDisplayMatching(mainWindow.getBounds()).workArea
  const window = new BrowserWindow(overlayWindowOptions(
    overlay,
    workArea,
    join(import.meta.dirname, 'overlay-preload.cjs'),
  ))
  configureOverlayWindow(window)
  window.setIgnoreMouseEvents(false)
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  desktopWindows.set(plugin.name, window)
  desktopWindowPlugins.set(window, plugin)
  desktopWindowCompactSizes.set(window, { width: overlay.width, height: overlay.height })
  desktopWindowExpanded.set(window, false)
  window.on('closed', () => {
    desktopWindowPlugins.delete(window)
    desktopWindowCompactSizes.delete(window)
    desktopWindowExpanded.delete(window)
    if (desktopWindows.get(plugin.name) === window) desktopWindows.delete(plugin.name)
  })
  const url = overlay.entry === 'dsh:web'
    ? runtimeUrl === undefined ? undefined : new URL(runtimeUrl)
    : new URL(pathToFileURL(overlay.entry).href)
  if (url === undefined) {
    destroyOverlayWindow(window)
    return
  }
  if (overlay.entry === 'dsh:web') url.searchParams.set('dsh-desktop-overlay', plugin.name)
  void window.loadURL(url.href).then(() => {
    if (!window.isDestroyed() && desktopWindows.get(plugin.name) === window) window.showInactive()
  })
}

function hideDesktopOverlay(name: string): void {
  const window = desktopWindows.get(name)
  if (window === undefined) return
  desktopWindows.delete(name)
  destroyOverlayWindow(window)
}

function closeDesktopOverlays(): void {
  for (const name of [...desktopWindows.keys()]) hideDesktopOverlay(name)
}

function overlayWindow(sender: Electron.WebContents): BrowserWindow | undefined {
  return [...desktopWindows.values()].find(window => !window.isDestroyed() && window.webContents === sender)
}

function registerOverlayIpc(): void {
  ipcMain.on('desktop:overlay:move-by', (event, x: unknown, y: unknown) => {
    const window = overlayWindow(event.sender)
    if (window === undefined || typeof x !== 'number' || typeof y !== 'number') return
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 100 || Math.abs(y) > 100) return
    const bounds = window.getBounds()
    window.setPosition(Math.round(bounds.x + x), Math.round(bounds.y + y))
  })
  ipcMain.on('desktop:overlay:set-expanded', (event, expanded: unknown) => {
    const window = overlayWindow(event.sender)
    if (window === undefined || typeof expanded !== 'boolean') return
    const overlay = desktopWindowPlugins.get(window)?.desktopOverlay
    if (overlay === undefined) return
    const compact = desktopWindowCompactSizes.get(window) ?? { width: overlay.width, height: overlay.height }
    desktopWindowExpanded.set(window, expanded)
    window.setBounds(overlayExpandedBounds(window.getBounds(), overlay, expanded, compact))
  })
  ipcMain.on('desktop:overlay:set-compact-size', (event, width: unknown, height: unknown) => {
    const window = overlayWindow(event.sender)
    if (window === undefined || typeof width !== 'number' || typeof height !== 'number') return
    const overlay = desktopWindowPlugins.get(window)?.desktopOverlay
    if (overlay === undefined || !Number.isFinite(width) || !Number.isFinite(height)) return
    const next = { width: Math.round(width), height: Math.round(height) }
    const maxWidth = Math.max(overlay.expandedWidth ?? overlay.width, overlay.width)
    const maxHeight = Math.max(overlay.expandedHeight ?? overlay.height, overlay.height)
    if (next.width < 64 || next.height < 64 || next.width > maxWidth || next.height > maxHeight) return
    desktopWindowCompactSizes.set(window, next)
    if (desktopWindowExpanded.get(window) !== true) {
      window.setBounds(overlayExpandedBounds(window.getBounds(), overlay, false, next))
    }
  })
  ipcMain.on('desktop:overlay:set-visible', (event, visible: unknown) => {
    const window = overlayWindow(event.sender)
    if (window === undefined || typeof visible !== 'boolean') return
    if (visible) window.showInactive()
    else window.hide()
  })
}

async function syncDesktopOverlays(): Promise<void> {
  const plugins = await listProfilePlugins(resolveWebProfileDir())
  const enabled = plugins.filter(plugin => plugin.enabled)
  const active = new Set(enabled.filter(plugin => plugin.desktopOverlay !== undefined).map(plugin => plugin.name))
  for (const plugin of enabled) showDesktopOverlay(plugin)
  for (const name of desktopWindows.keys()) if (!active.has(name)) hideDesktopOverlay(name)
}

async function startRuntime(): Promise<void> {
  const next = new DshProcess(runtimeEntry, {
    cwd: workspace,
    args: ['web', '--patch', desktopPatchPath(), '--host', '127.0.0.1', '--port', '0'],
  })
  runtime = next
  const state = await next.start()
  runtimeUrl = state.url
  const desktopUrl = new URL(state.url)
  desktopUrl.searchParams.set('dsh-desktop', '1')
  await mainWindow?.loadURL(desktopUrl.href)
  await mainWindow?.webContents.executeJavaScript(
    `window.localStorage.setItem(${JSON.stringify(DESKTOP_HOST_MARKER)}, '1')`,
  )
  await mainWindow?.loadURL(state.url)
}

async function restartRuntime(nextWorkspace?: string): Promise<void> {
  await runtimeOperations.run(async () => {
    if (nextWorkspace !== undefined) workspace = nextWorkspace
    await mainWindow?.loadURL(loadingPage('Restarting the local runtime...'))
    closeDesktopOverlays()
    await runtime?.stop()
    runtime = undefined
    runtimeUrl = undefined
    await startRuntime()
    await syncDesktopOverlays()
  })
}

async function mutatePlugins(operation: () => Promise<void>, success: string): Promise<PluginMutationResult> {
  return await runtimeOperations.run(async () => {
    closeDesktopOverlays()
    await runtime?.stop()
    runtime = undefined
    runtimeUrl = undefined
    try {
      await operation()
      await syncProfileSupportPackages(
        resolveWebProfileDir(), runtimeEntry, workspace, runPluginCommand, requiredDesktopSupportPackages(),
      )
    } finally {
      await startRuntime()
    }
    await syncDesktopOverlays()
    return { changed: true, message: success }
  })
}

function assertPluginRenderer(event: IpcMainInvokeEvent): void {
  if (pluginWindow === undefined
    || event.sender !== pluginWindow.webContents
    || !isTrustedRendererFrame(event.senderFrame?.url, PLUGIN_MANAGER_URL)) {
    throw new Error('Desktop plugin API is available only to the local plugin manager')
  }
}

function assertWebRenderer(event: IpcMainInvokeEvent): void {
  if (mainWindow === undefined || event.sender !== mainWindow.webContents
    || !isTrustedRuntimeFrame(event.senderFrame?.url, runtimeUrl)) {
    throw new Error('Desktop Web plugin API is available only to the local main window')
  }
}

async function installLocalPlugin(parent: BrowserWindow): Promise<PluginMutationResult> {
  const copy = pluginLocale(app.getPreferredSystemLanguages()[0] ?? app.getLocale())
  const selection = await dialog.showOpenDialog(parent, {
    title: copy.installTitle,
    buttonLabel: copy.installLocal,
    properties: ['openDirectory'],
  })
  const selected = selection.filePaths[0]
  if (selection.canceled || selected === undefined) return { changed: false, message: copy.installCanceled }
  return await mutatePlugins(
    async () => { await runPluginCommand(runtimeEntry, workspace, ['add', selected]) },
    copy.installed(selected),
  )
}

async function removePlugin(parent: BrowserWindow, name: string): Promise<PluginMutationResult> {
  const copy = pluginLocale(app.getPreferredSystemLanguages()[0] ?? app.getLocale())
  const profileDir = resolveWebProfileDir()
  const plugin = (await listProfilePlugins(profileDir)).find(candidate => candidate.name === name)
  if (plugin === undefined) throw new Error(`Plugin is not installed: ${name}`)
  const confirmation = await dialog.showMessageBox(parent, {
    type: 'warning',
    buttons: [copy.cancel, copy.remove],
    defaultId: 0,
    cancelId: 0,
    title: copy.removeTitle,
    message: copy.removeMessage(name),
    detail: copy.removeDetail,
  })
  if (confirmation.response !== 1) return { changed: false, message: copy.removalCanceled }
  return await mutatePlugins(
    async () => {
      await runPluginCommand(runtimeEntry, workspace, ['remove', name])
      await cleanupPluginSettings(resolveSettingsFile(), plugin.settingsNamespaces ?? [])
      await cleanupProfilePluginLink(profileDir, name)
    },
    copy.removed(name),
  )
}

async function setPluginEnabled(parent: BrowserWindow, name: string, enabled: boolean): Promise<PluginMutationResult> {
  const copy = pluginLocale(app.getPreferredSystemLanguages()[0] ?? app.getLocale())
  const plugin = (await listProfilePlugins(resolveWebProfileDir())).find(candidate => candidate.name === name)
  if (plugin === undefined) throw new Error(`Plugin is not installed: ${name}`)
  if (plugin.enabled === enabled) return { changed: false, message: copy.alreadyToggled(name, enabled) }
  const action = enabled ? copy.enable : copy.disable
  const confirmation = await dialog.showMessageBox(parent, {
    type: 'question',
    buttons: [copy.cancel, action],
    defaultId: 1,
    cancelId: 0,
    title: copy.toggleTitle(enabled),
    message: copy.toggleMessage(name, enabled),
    detail: copy.toggleDetail(enabled),
  })
  if (confirmation.response !== 1) return { changed: false, message: copy.toggleCanceled(enabled) }
  return await mutatePlugins(
    async () => { await setProfilePluginEnabled(resolveWebProfileDir(), name, enabled) },
    copy.toggleComplete(name, enabled),
  )
}

function registerPluginIpc(): void {
  const profileDir = resolveWebProfileDir()
  ipcMain.handle('desktop:plugins:list', async (event) => {
    assertPluginRenderer(event)
    return await listProfilePlugins(profileDir)
  })
  ipcMain.handle('desktop:plugins:locale', (event) => {
    assertPluginRenderer(event)
    return app.getPreferredSystemLanguages()[0] ?? app.getLocale()
  })
  ipcMain.handle('desktop:plugins:install', async (event) => {
    assertPluginRenderer(event)
    const manager = pluginWindow
    if (manager === undefined) throw new Error('Plugin manager window is unavailable')
    return await installLocalPlugin(manager)
  })
  ipcMain.handle('desktop:plugins:remove', async (event, name: unknown) => {
    assertPluginRenderer(event)
    if (typeof name !== 'string') throw new TypeError('Plugin name must be a string')
    const manager = pluginWindow
    if (manager === undefined) throw new Error('Plugin manager window is unavailable')
    return await removePlugin(manager, name)
  })
  ipcMain.handle('desktop:plugins:set-enabled', async (event, name: unknown, enabled: unknown) => {
    assertPluginRenderer(event)
    if (typeof name !== 'string' || typeof enabled !== 'boolean') throw new TypeError('Invalid plugin enablement request')
    if (pluginWindow === undefined) throw new Error('Plugin manager window is unavailable')
    return await setPluginEnabled(pluginWindow, name, enabled)
  })
  ipcMain.handle('desktop:plugins:open-profile', async (event) => {
    assertPluginRenderer(event)
    await shell.openPath(profileDir)
  })
  ipcMain.handle('desktop:plugins:open-source', async (event, name: unknown) => {
    assertPluginRenderer(event)
    if (typeof name !== 'string') throw new TypeError('Plugin name must be a string')
    const plugin = (await listProfilePlugins(profileDir)).find(candidate => candidate.name === name)
    if (plugin?.localPath === undefined) throw new Error(`Plugin has no editable local source: ${name}`)
    await shell.openPath(plugin.localPath)
  })
  ipcMain.handle('desktop:runtime:restart', async (event) => {
    assertPluginRenderer(event)
    await restartRuntime()
  })
  ipcMain.handle('desktop:web-plugins:list', async (event) => {
    assertWebRenderer(event)
    return await listProfilePlugins(profileDir)
  })
  ipcMain.handle('desktop:web-plugins:install', async (event) => {
    assertWebRenderer(event)
    if (mainWindow === undefined) throw new Error('Main window is unavailable')
    return await installLocalPlugin(mainWindow)
  })
  ipcMain.handle('desktop:web-plugins:remove', async (event, name: unknown) => {
    assertWebRenderer(event)
    if (typeof name !== 'string') throw new TypeError('Plugin name must be a string')
    if (mainWindow === undefined) throw new Error('Main window is unavailable')
    return await removePlugin(mainWindow, name)
  })
  ipcMain.handle('desktop:web-plugins:set-enabled', async (event, name: unknown, enabled: unknown) => {
    assertWebRenderer(event)
    if (typeof name !== 'string' || typeof enabled !== 'boolean') throw new TypeError('Invalid plugin enablement request')
    if (mainWindow === undefined) throw new Error('Main window is unavailable')
    return await setPluginEnabled(mainWindow, name, enabled)
  })
}

function showPluginManager(): void {
  if (pluginWindow !== undefined) {
    pluginWindow.show()
    pluginWindow.focus()
    return
  }
  const parent = mainWindow
  if (parent === undefined) return
  pluginWindow = new BrowserWindow(pluginWindowOptions(parent, join(import.meta.dirname, 'preload.cjs')))
  pluginWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  pluginWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== PLUGIN_MANAGER_URL) event.preventDefault()
  })
  pluginWindow.on('closed', () => { pluginWindow = undefined })
  pluginWindow.once('ready-to-show', () => { pluginWindow?.show() })
  void pluginWindow.loadURL(PLUGIN_MANAGER_URL)
}

function buildMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: APP_NAME,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Workspace...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            const window = mainWindow
            if (window === undefined) return
            void dialog.showOpenDialog(window, { properties: ['openDirectory'] }).then(async (selection) => {
              const selected = selection.filePaths[0]
              if (!selection.canceled && selected !== undefined) {
                await restartRuntime(selected)
              }
            })
          },
        },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    {
      label: 'Plugins',
      submenu: [
        { label: 'Manage Plugins...', accelerator: 'CmdOrCtrl+Shift+X', click: showPluginManager },
        { label: 'Restart DSH', accelerator: 'CmdOrCtrl+Shift+R', click: () => { void restartRuntime() } },
      ],
    },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'zoom' }, { type: 'separator' }, { role: 'front' }] },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

async function boot(): Promise<void> {
  await runDesktopBoot({
    showLoadingWindow: async () => {
      mainWindow = createMainWindow()
      await revealLoadingWindow(mainWindow, loadingPage('Starting the local runtime...'))
    },
    prepareProfile: async () => {
      runtimeEntry = await resolveDshEntry(app.isPackaged, process.resourcesPath)
      const profileDir = resolveWebProfileDir()
      await initializeWebProfile(profileDir)
      await removeRetiredDesktopDefaults(profileDir, runtimeEntry)
      await syncProfileSupportPackages(
        profileDir, runtimeEntry, workspace, runPluginCommand, requiredDesktopSupportPackages(),
      )
      registerPluginIpc()
      registerOverlayIpc()
      buildMenu()
    },
    startRuntime: async () => {
      await startRuntime()
      await syncDesktopOverlays()
    },
    reportFailure: async (error) => {
      const options = {
        type: 'error' as const,
        title: 'DSH failed to start',
        message: 'DeepSeek Harness could not start.',
        detail: error instanceof Error ? error.message : String(error),
      }
      if (mainWindow === undefined) await dialog.showMessageBox(options)
      else await dialog.showMessageBox(mainWindow, options)
      app.quit()
    },
  })
}

app.setName(APP_NAME)
// Electron derives this path before app.setName() affects the default. Pin it
// before taking the single-instance lock so other Electron apps cannot collide.
app.setPath('userData', join(app.getPath('appData'), APP_NAME))
if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', () => {
    if (mainWindow?.isMinimized()) mainWindow.restore()
    mainWindow?.show()
    mainWindow?.focus()
  })
  app.on('before-quit', (event) => {
    if (quitting) return
    event.preventDefault()
    quitting = true
    void runtimeOperations.close()
      .then(async () => await runtime?.stop())
      .finally(() => { app.exit(0) })
  })
  app.on('window-all-closed', () => { app.quit() })
  void app.whenReady().then(boot)
}
