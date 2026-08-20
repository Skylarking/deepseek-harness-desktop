/** Narrow plugin-management bridge for the Desktop-hosted Web settings page. */
import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopWebPluginApi } from './contracts.ts'

window.open = () => null

const api: DesktopWebPluginApi = {
  installLocal: async () => await ipcRenderer.invoke('desktop:web-plugins:install') as Awaited<ReturnType<DesktopWebPluginApi['installLocal']>>,
  list: async () => await ipcRenderer.invoke('desktop:web-plugins:list') as Awaited<ReturnType<DesktopWebPluginApi['list']>>,
  remove: async name => await ipcRenderer.invoke('desktop:web-plugins:remove', name) as Awaited<ReturnType<DesktopWebPluginApi['remove']>>,
  setEnabled: async (name, enabled) => await ipcRenderer.invoke('desktop:web-plugins:set-enabled', name, enabled) as Awaited<ReturnType<DesktopWebPluginApi['setEnabled']>>,
}

contextBridge.exposeInMainWorld('dshDesktopPlugins', api)
