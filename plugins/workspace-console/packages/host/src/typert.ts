/** Host Typert contribution owned by the external workspace-console plugin. */

import { WORKSPACE_CONSOLE_INVOCATIONS } from './remote-contract.ts'

/** Runtime contribution loaded from the package's `./typert` export. */
export const TYPERT = {
  package: '@deepseek-ai/dsh-host-workspace-console',
  face: 'host',
  schemas: [],
  invocations: WORKSPACE_CONSOLE_INVOCATIONS,
  model: { services: [], events: [], objects: [] },
} as const
