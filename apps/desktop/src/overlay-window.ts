import type { BrowserWindowConstructorOptions, Rectangle } from 'electron'
import type { DesktopOverlayManifest } from './contracts.ts'

interface ConfigurableOverlayWindow {
  setAlwaysOnTop(flag: boolean, level?: 'floating'): void
  setVisibleOnAllWorkspaces(flag: boolean, options?: {
    visibleOnFullScreen?: boolean
    skipTransformProcessType?: boolean
  }): void
}

/** Build the sandboxed native window options for one plugin-owned overlay. */
export function overlayWindowOptions(
  overlay: DesktopOverlayManifest,
  workArea: Rectangle,
  preload: string,
  platform: NodeJS.Platform = process.platform,
): BrowserWindowConstructorOptions {
  return {
    width: overlay.width,
    height: overlay.height,
    x: overlay.x ?? workArea.x + workArea.width - overlay.width - 24,
    y: overlay.y ?? workArea.y + workArea.height - overlay.height - 24,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    show: false,
    ...(platform === 'darwin' ? {
      acceptFirstMouse: true,
      enableLargerThanScreen: true,
      type: 'panel' as const,
    } : {}),
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  }
}

/** Keep a plugin overlay above applications and macOS full-screen Spaces without taking focus. */
export function configureOverlayWindow(
  window: ConfigurableOverlayWindow,
  platform: NodeJS.Platform = process.platform,
): void {
  if (platform === 'darwin') {
    window.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
      skipTransformProcessType: true,
    })
  }
  window.setAlwaysOnTop(true, 'floating')
}

/** Resize an overlay around its fixed bottom-right corner. */
export function overlayExpandedBounds(
  bounds: Rectangle,
  overlay: DesktopOverlayManifest,
  expanded: boolean,
  compact = { width: overlay.width, height: overlay.height },
): Rectangle {
  const width = expanded ? Math.max(overlay.expandedWidth ?? compact.width, compact.width) : compact.width
  const height = expanded ? Math.max(overlay.expandedHeight ?? compact.height, compact.height) : compact.height
  return {
    x: bounds.x + bounds.width - width,
    y: bounds.y + bounds.height - height,
    width,
    height,
  }
}
