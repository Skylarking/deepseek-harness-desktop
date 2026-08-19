/** Read-only Remote gateway for files inside registered workspaces. */

import { readFile, readdir, realpath, stat } from 'node:fs/promises'
import { extname, isAbsolute, join, relative, sep } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import type {} from 'zod'
import type {
  WorkspaceDirectoryListing, WorkspaceFileEntry, WorkspaceFilePreview,
} from './types.ts'

export type * from './types.ts'

const MAX_DIRECTORY_ENTRIES = 500
const MAX_TEXT_BYTES = 1024 * 1024
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const IGNORED_DIRECTORIES = new Set(['.git', '.next', '.turbo', 'coverage', 'dist', 'lib', 'node_modules'])
const IMAGE_TYPES: Readonly<Record<string, string>> = {
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

/** Resolve an input path beneath one registered workspace, including symlink containment. */
async function resolveWorkspacePath(ctx: Context, workspaceId: string, input: string): Promise<{
  root: string
  path: string
  relativePath: string
}> {
  const workspace = ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
  if (workspace === undefined) throw new Error(`unknown workspace '${workspaceId}'`)
  if (input.includes('\0') || isAbsolute(input) || input.split(/[\\/]+/u).includes('..')) {
    throw new Error('workspace file path must be relative and cannot contain parent traversal')
  }
  const relativePath = input.split(/[\\/]+/u).filter(Boolean).join('/')
  const root = await realpath(workspace.path)
  const path = await realpath(join(root, ...relativePath.split('/').filter(Boolean)))
  const fromRoot = relative(root, path)
  if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    throw new Error('workspace file path escapes the registered workspace')
  }
  return { root, path, relativePath }
}

/** Remote-only service exposing bounded reads under registered workspace roots. */
export class WorkspaceFilesGateway extends TypertRemoteService {
  static inject = ['workspaceRegistry']

  constructor(ctx: Context) {
    super(ctx, 'workspaceFiles')
  }

  /**
   * List one directory without recursively reading its contents.
   * @param workspaceId - Registered workspace id.
   * @param path - Workspace-relative directory path; empty selects the root.
   * @returns Immediate children in directory-first, case-insensitive name order.
   */
  @Remote('list')
  async list(workspaceId: string, path: string): Promise<WorkspaceDirectoryListing> {
    const resolved = await resolveWorkspacePath(this.ctx, workspaceId, path)
    if (!(await stat(resolved.path)).isDirectory()) throw new Error(`workspace path '${path}' is not a directory`)
    const children = await readdir(resolved.path, { withFileTypes: true })
    const entries: WorkspaceFileEntry[] = []
    for (const child of children) {
      if (entries.length >= MAX_DIRECTORY_ENTRIES) break
      const childPath = resolved.relativePath === '' ? child.name : `${resolved.relativePath}/${child.name}`
      try {
        const canonical = await realpath(join(resolved.path, child.name))
        const fromRoot = relative(resolved.root, canonical)
        if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) continue
        const childStat = await stat(canonical)
        if (!childStat.isDirectory() && !childStat.isFile()) continue
        entries.push({
          name: child.name,
          path: childPath,
          kind: childStat.isDirectory() ? 'directory' : 'file',
          ignored: childStat.isDirectory() && IGNORED_DIRECTORIES.has(child.name),
        })
      } catch {
        // A disappearing or unreadable child does not make its parent unusable.
      }
    }
    entries.sort((left, right) =>
      Number(right.kind === 'directory') - Number(left.kind === 'directory')
      || left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }))
    return { path: resolved.relativePath, entries, truncated: children.length > entries.length }
  }

  /**
   * Read a bounded text or image preview.
   * @param workspaceId - Registered workspace id.
   * @param path - Workspace-relative file path.
   * @returns Text, base64 image data, or a stable unsupported reason.
   */
  @Remote('read')
  async read(workspaceId: string, path: string): Promise<WorkspaceFilePreview> {
    const resolved = await resolveWorkspacePath(this.ctx, workspaceId, path)
    const fileStat = await stat(resolved.path)
    if (!fileStat.isFile()) throw new Error(`workspace path '${path}' is not a file`)
    const mimeType = IMAGE_TYPES[extname(resolved.path).toLowerCase()]
    if (mimeType !== undefined) {
      if (fileStat.size > MAX_IMAGE_BYTES) return { kind: 'unsupported', path: resolved.relativePath, reason: 'too-large' }
      try {
        return { kind: 'image', path: resolved.relativePath, mimeType, base64: (await readFile(resolved.path)).toString('base64') }
      } catch {
        return { kind: 'unsupported', path: resolved.relativePath, reason: 'unreadable' }
      }
    }
    if (fileStat.size > MAX_TEXT_BYTES) return { kind: 'unsupported', path: resolved.relativePath, reason: 'too-large' }
    try {
      const bytes = await readFile(resolved.path)
      if (bytes.includes(0)) return { kind: 'unsupported', path: resolved.relativePath, reason: 'binary' }
      return { kind: 'text', path: resolved.relativePath, content: new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
    } catch {
      return { kind: 'unsupported', path: resolved.relativePath, reason: 'unreadable' }
    }
  }
}

export default WorkspaceFilesGateway
