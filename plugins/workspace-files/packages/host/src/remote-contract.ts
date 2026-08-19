/** Plugin-owned Typert descriptors for the external workspace-files package. */

import { z } from 'zod'
import type { InvocationDescriptor } from '@deepseek-ai/dsh-typert-protocol'

const workspaceId = z.string()
const path = z.string()
const entry = z.object({
  name: z.string(),
  path: z.string(),
  kind: z.union([z.literal('file'), z.literal('directory')]),
  ignored: z.boolean(),
})
const listing = z.object({ path: z.string(), entries: z.array(entry), truncated: z.boolean() })
const preview = z.union([
  z.object({ kind: z.literal('text'), path: z.string(), content: z.string() }),
  z.object({ kind: z.literal('image'), path: z.string(), mimeType: z.string(), base64: z.string() }),
  z.object({
    kind: z.literal('unsupported'),
    path: z.string(),
    reason: z.union([z.literal('binary'), z.literal('too-large'), z.literal('unreadable')]),
  }),
])

function parameter(name: string, schema: z.ZodType): InvocationDescriptor['parameters'][number] {
  return {
    name,
    wire: name,
    source: 'json',
    codec: { mode: 'strict', typeSymbol: `@deepseek-ai/dsh-host-workspace-files#${name}`, schema },
  }
}

/** Host and Client descriptors shared by this plugin's two Typert artifacts. */
export const WORKSPACE_FILES_INVOCATIONS = [
  {
    id: '@deepseek-ai/dsh-host-workspace-files#workspaceFiles/list',
    service: 'workspaceFiles',
    namespace: 'workspaceFiles',
    method: 'list',
    invocation: { kind: 'direct' },
    parameters: [parameter('workspaceId', workspaceId), parameter('path', path)],
    result: {
      mode: 'strict',
      typeSymbol: '@deepseek-ai/dsh-host-workspace-files/types#WorkspaceDirectoryListing',
      schema: listing,
    },
  },
  {
    id: '@deepseek-ai/dsh-host-workspace-files#workspaceFiles/read',
    service: 'workspaceFiles',
    namespace: 'workspaceFiles',
    method: 'read',
    invocation: { kind: 'direct' },
    parameters: [parameter('workspaceId', workspaceId), parameter('path', path)],
    result: {
      mode: 'strict',
      typeSymbol: '@deepseek-ai/dsh-host-workspace-files/types#WorkspaceFilePreview',
      schema: preview,
    },
  },
] as const satisfies readonly InvocationDescriptor[]
