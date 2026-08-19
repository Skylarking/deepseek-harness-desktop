/** Restricted bridge for the local plugin manager renderer. */
import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopPluginApi } from './contracts.ts'

const api: DesktopPluginApi = {
  installLocal: async () => await ipcRenderer.invoke('desktop:plugins:install') as Awaited<ReturnType<DesktopPluginApi['installLocal']>>,
  list: async () => await ipcRenderer.invoke('desktop:plugins:list') as Awaited<ReturnType<DesktopPluginApi['list']>>,
  openProfile: async () => { await ipcRenderer.invoke('desktop:plugins:open-profile') },
  openSource: async (name) => { await ipcRenderer.invoke('desktop:plugins:open-source', name) },
  remove: async name => await ipcRenderer.invoke('desktop:plugins:remove', name) as Awaited<ReturnType<DesktopPluginApi['remove']>>,
  restart: async () => { await ipcRenderer.invoke('desktop:runtime:restart') },
  setEnabled: async (name, enabled) => await ipcRenderer.invoke('desktop:plugins:set-enabled', name, enabled) as Awaited<ReturnType<DesktopPluginApi['setEnabled']>>,
}

contextBridge.exposeInMainWorld('dshDesktop', api)
