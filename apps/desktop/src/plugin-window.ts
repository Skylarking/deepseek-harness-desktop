import type { BrowserWindow, BrowserWindowConstructorOptions } from 'electron'

/** Build the compact modal window used for profile package management. */
export function pluginWindowOptions(parent: object, preload: string): BrowserWindowConstructorOptions {
  return {
    parent: parent as BrowserWindow,
    modal: false,
    show: false,
    width: 720,
    height: 560,
    minWidth: 640,
    minHeight: 480,
    closable: true,
    minimizable: false,
    maximizable: true,
    fullscreenable: false,
    title: 'DSH Plugins',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  }
}
