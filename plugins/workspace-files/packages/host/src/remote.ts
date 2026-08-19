/** Client Remote contribution owned by the external workspace-files plugin. */

import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { WorkspaceDirectoryListing, WorkspaceFilePreview } from './types.ts'
import { WORKSPACE_FILES_INVOCATIONS } from './remote-contract.ts'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespaceMap {
    workspaceFiles: {
      list: (workspaceId: string, path: string) => Promise<RemoteResult<WorkspaceDirectoryListing>>
      read: (workspaceId: string, path: string) => Promise<RemoteResult<WorkspaceFilePreview>>
    }
  }
  interface TypertRemoteMap {
    'workspaceFiles/list': (workspaceId: string, path: string) => Promise<RemoteResult<WorkspaceDirectoryListing>>
    'workspaceFiles/read': (workspaceId: string, path: string) => Promise<RemoteResult<WorkspaceFilePreview>>
  }
}

/** Contribution mounted by the workspace-files Client plugin. */
export const TYPERT_REMOTE = {
  package: '@deepseek-ai/dsh-host-workspace-files',
  descriptors: WORKSPACE_FILES_INVOCATIONS,
} satisfies TypertRemoteContribution

export default TYPERT_REMOTE
