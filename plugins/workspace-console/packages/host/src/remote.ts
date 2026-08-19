/** Client Remote contribution owned by the external workspace-console plugin. */

import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { WorkspaceConsoleOpenResult, WorkspaceConsoleReadResult, WorkspaceConsoleSessionId } from './types.ts'
import { WORKSPACE_CONSOLE_INVOCATIONS } from './remote-contract.ts'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespaceMap {
    workspaceConsole: {
      open: (workspaceId: string, cols: number, rows: number) => Promise<RemoteResult<WorkspaceConsoleOpenResult>>
      write: (sessionId: WorkspaceConsoleSessionId, data: string) => Promise<RemoteResult<void>>
      read: (sessionId: WorkspaceConsoleSessionId, fromByte: number) => Promise<RemoteResult<WorkspaceConsoleReadResult>>
      resize: (sessionId: WorkspaceConsoleSessionId, cols: number, rows: number) => Promise<RemoteResult<void>>
      close: (sessionId: WorkspaceConsoleSessionId) => Promise<RemoteResult<void>>
    }
  }
  interface TypertRemoteMap {
    'workspaceConsole/open': (workspaceId: string, cols: number, rows: number) => Promise<RemoteResult<WorkspaceConsoleOpenResult>>
    'workspaceConsole/write': (sessionId: WorkspaceConsoleSessionId, data: string) => Promise<RemoteResult<void>>
    'workspaceConsole/read': (sessionId: WorkspaceConsoleSessionId, fromByte: number) => Promise<RemoteResult<WorkspaceConsoleReadResult>>
    'workspaceConsole/resize': (sessionId: WorkspaceConsoleSessionId, cols: number, rows: number) => Promise<RemoteResult<void>>
    'workspaceConsole/close': (sessionId: WorkspaceConsoleSessionId) => Promise<RemoteResult<void>>
  }
}

/** Contribution mounted by the workspace-console Client plugin. */
export const TYPERT_REMOTE = {
  package: '@deepseek-ai/dsh-host-workspace-console',
  descriptors: WORKSPACE_CONSOLE_INVOCATIONS,
} satisfies TypertRemoteContribution

export default TYPERT_REMOTE
