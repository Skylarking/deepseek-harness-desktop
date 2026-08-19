/** A plugin-owned native overlay rendered by the Desktop host. */
export interface DesktopOverlayManifest {
  entry: string
  width: number
  height: number
  expandedWidth?: number
  expandedHeight?: number
  x?: number
  y?: number
}

/** Installed plugin information exposed to the desktop plugin manager. */
export interface DesktopPlugin {
  name: string
  spec: string
  enabled: boolean
  localPath?: string
  desktopOverlay?: DesktopOverlayManifest
  settingsNamespaces?: string[]
  /** Profile-local package aliases required only while this plugin is enabled. */
  supportPackages?: Record<string, string>
}

/** Plugin-manager row for one installed profile plugin. */
export type DesktopManagedPlugin = DesktopPlugin

/** Result of a plugin-changing command. */
export interface PluginMutationResult {
  changed: boolean
  message: string
}

/** Narrow renderer API; filesystem paths come only from the Host-owned profile manifest. */
export interface DesktopPluginApi {
  installLocal(): Promise<PluginMutationResult>
  list(): Promise<DesktopManagedPlugin[]>
  openProfile(): Promise<void>
  openSource(name: string): Promise<void>
  remove(name: string): Promise<PluginMutationResult>
  restart(): Promise<void>
  setEnabled(name: string, enabled: boolean): Promise<PluginMutationResult>
}

/** Bridge exposed only inside the Desktop-hosted Web renderer. */
export type DesktopWebPluginApi = Pick<DesktopPluginApi, 'installLocal' | 'list' | 'remove' | 'setEnabled'>
