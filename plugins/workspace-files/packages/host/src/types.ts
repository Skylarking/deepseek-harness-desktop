/** Client-safe payloads for read-only workspace file browsing. */

/** One immediate child of a registered workspace directory. */
export interface WorkspaceFileEntry {
  /** Basename shown in the file tree. */
  name: string
  /** POSIX-style path relative to the workspace root. */
  path: string
  /** Files can be previewed; directories can be listed. */
  kind: 'file' | 'directory'
  /** True when expansion is intentionally disabled for a generated or metadata directory. */
  ignored: boolean
}

/** Bounded directory response in stable name order. */
export interface WorkspaceDirectoryListing {
  /** Directory path relative to the workspace root; empty means the root. */
  path: string
  /** Immediate children only. */
  entries: WorkspaceFileEntry[]
  /** True when additional entries were omitted by the item bound. */
  truncated: boolean
}

/** Preview response for text, supported images, and rejected files. */
export type WorkspaceFilePreview =
  | { kind: 'text'; path: string; content: string }
  | { kind: 'image'; path: string; mimeType: string; base64: string }
  | { kind: 'unsupported'; path: string; reason: 'binary' | 'too-large' | 'unreadable' }
