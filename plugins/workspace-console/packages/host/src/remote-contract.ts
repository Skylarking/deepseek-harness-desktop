/** Plugin-owned Typert descriptors for the external workspace-console package. */

import { z } from 'zod'
import type { InvocationDescriptor } from '@deepseek-ai/dsh-typert-protocol'

const sessionId = z.string()
const output = z.object({
  text: z.string(),
  nextOffset: z.number(),
  lossy: z.boolean(),
  exited: z.boolean(),
  exitCode: z.union([z.number(), z.null()]),
  signal: z.union([z.string(), z.null()]),
})

function parameter(name: string, schema: z.ZodType): InvocationDescriptor['parameters'][number] {
  return {
    name,
    wire: name,
    source: 'json',
    codec: { mode: 'strict', typeSymbol: `@deepseek-ai/dsh-host-workspace-console#${name}`, schema },
  }
}

function invocation(
  method: string,
  parameters: InvocationDescriptor['parameters'],
  schema: z.ZodType,
  resultType: string,
): InvocationDescriptor {
  return {
    id: `@deepseek-ai/dsh-host-workspace-console#workspaceConsole/${method}`,
    service: 'workspaceConsole',
    namespace: 'workspaceConsole',
    method,
    invocation: { kind: 'direct' },
    parameters,
    result: { mode: 'strict', typeSymbol: resultType, schema },
  }
}

/** Host and Client descriptors shared by this plugin's two Typert artifacts. */
export const WORKSPACE_CONSOLE_INVOCATIONS = [
  invocation('open', [
    parameter('workspaceId', z.string()),
    parameter('cols', z.number()),
    parameter('rows', z.number()),
  ], z.object({ sessionId }), '@deepseek-ai/dsh-host-workspace-console/types#WorkspaceConsoleOpenResult'),
  invocation('write', [parameter('sessionId', sessionId), parameter('data', z.string())], z.undefined(), 'void'),
  invocation('read', [parameter('sessionId', sessionId), parameter('fromByte', z.number())], output, '@deepseek-ai/dsh-host-workspace-console/types#WorkspaceConsoleReadResult'),
  invocation('resize', [
    parameter('sessionId', sessionId),
    parameter('cols', z.number()),
    parameter('rows', z.number()),
  ], z.undefined(), 'void'),
  invocation('close', [parameter('sessionId', sessionId)], z.undefined(), 'void'),
] as const satisfies readonly InvocationDescriptor[]
