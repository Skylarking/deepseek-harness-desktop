import type { DesktopPluginApi } from '../contracts.ts'

declare global {
  interface Window {
    dshDesktop: DesktopPluginApi
  }
}

export {}
