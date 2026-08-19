/** Ordered Desktop startup operations with one visible failure path. */
export interface DesktopBootLifecycle {
  /** Create and reveal the loading window before fallible profile preparation. */
  showLoadingWindow: () => Promise<void>
  /** Initialize the profile and register host integrations. */
  prepareProfile: () => Promise<void>
  /** Start the local runtime and attach its Web UI. */
  startRuntime: () => Promise<void>
  /** Present any startup-stage failure to the user. */
  reportFailure: (error: unknown) => Promise<void>
}

/** Browser window operations required to reveal the loading document. */
export interface DesktopLoadingWindow {
  /** Load one trusted Desktop document. */
  loadURL: (url: string) => Promise<void>
  /** Make the loaded window visible. */
  show: () => void
  /** Activate the visible window for the launching user. */
  focus: () => void
}

/** Reveal a window explicitly after its loading document is ready. */
export async function revealLoadingWindow(window: DesktopLoadingWindow, url: string): Promise<void> {
  await window.loadURL(url)
  window.show()
  window.focus()
}

/** Run every Desktop startup stage through the same visible failure handler. */
export async function runDesktopBoot(lifecycle: DesktopBootLifecycle): Promise<void> {
  try {
    await lifecycle.showLoadingWindow()
    await lifecycle.prepareProfile()
    await lifecycle.startRuntime()
  } catch (error) {
    await lifecycle.reportFailure(error)
  }
}
