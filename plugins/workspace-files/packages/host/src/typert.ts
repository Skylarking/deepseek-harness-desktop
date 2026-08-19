/** Host Typert contribution owned by the external workspace-files plugin. */

import { WORKSPACE_FILES_INVOCATIONS } from './remote-contract.ts'

/** Runtime contribution loaded from the package's `./typert` export. */
export const TYPERT = {
  package: '@deepseek-ai/dsh-host-workspace-files',
  face: 'host',
  schemas: [],
  invocations: WORKSPACE_FILES_INVOCATIONS,
  model: { services: [], events: [], objects: [] },
} as const
