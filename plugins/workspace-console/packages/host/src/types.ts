/** Client-safe workspace console payloads. */

import type { Branded } from '@deepseek-ai/dsh-brand'

/** Opaque identity of one human-owned workspace terminal session. */
export type WorkspaceConsoleSessionId = Branded<'WorkspaceConsoleSessionId'>

/**
 * Create a typed workspace-console session id from its wire value.
 * @param value - opaque id received from or issued across the Remote boundary.
 * @returns branded session identity.
 */
export function WorkspaceConsoleSessionId(value: string): WorkspaceConsoleSessionId {
  return value as WorkspaceConsoleSessionId
}

/** Result of allocating a persistent workspace terminal. */
export interface WorkspaceConsoleOpenResult {
  /** Identity used for subsequent terminal operations. */
  sessionId: WorkspaceConsoleSessionId
}

/** Incremental terminal output and current process state. */
export interface WorkspaceConsoleReadResult {
  /** Terminal text captured since the requested byte offset. */
  text: string
  /** Whole-stream byte offset for the next read. */
  nextOffset: number
  /** True when the requested offset fell behind the retained output window. */
  lossy: boolean
  /** True after the top-level terminal process exits. */
  exited: boolean
  /** Exit code once exited; null while running or when signalled. */
  exitCode: number | null
  /** Terminating signal once exited; null while running or after normal exit. */
  signal: string | null
}
