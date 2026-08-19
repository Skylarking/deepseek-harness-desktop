import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Context } from '@deepseek-ai/cordis'
import { TypertGatewayService } from '@deepseek-ai/dsh-api-gateway'
import { TypertRegistry } from '@deepseek-ai/dsh-typert-registry'
import WorkspaceFilesGateway from '../src/index.ts'
import { TYPERT_REMOTE } from '../src/remote.ts'
import { TYPERT } from '../src/typert.ts'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true }))) })

async function harness(): Promise<{ gateway: WorkspaceFilesGateway; root: string; outside: string }> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-workspace-files-'))
  const outside = await mkdtemp(join(tmpdir(), 'dsh-workspace-files-outside-'))
  roots.push(root, outside)
  const ctx = new Context()
  ctx.provide('workspaceRegistry', { get: (id: string) => id === 'known' ? { path: root } : undefined } as never)
  return { gateway: new WorkspaceFilesGateway(ctx), root, outside }
}

describe('WorkspaceFilesGateway', () => {
  it('publishes matching descriptors and dispatches every Remote through the Host gateway', async () => {
    const { root } = await harness()
    await writeFile(join(root, 'hello.txt'), 'hello\n')
    const ctx = new Context()
    ctx.provide('workspaceRegistry', { get: (id: string) => id === 'known' ? { path: root } : undefined } as never)
    await ctx.plugin(TypertRegistry)
    await ctx.plugin(TypertGatewayService)
    ctx.typert.register(TYPERT)
    await ctx.plugin(WorkspaceFilesGateway)

    expect(TYPERT.invocations.map(descriptor => descriptor.method)).toEqual(['list', 'read'])
    expect(TYPERT_REMOTE.descriptors).toBe(TYPERT.invocations)
    await expect(ctx.typertGateway.invoke({
      namespace: 'workspaceFiles', method: 'list', args: { workspaceId: 'known', path: '' },
    })).resolves.toMatchObject({ path: '', entries: [expect.objectContaining({ name: 'hello.txt' })] })
    await expect(ctx.typertGateway.invoke({
      namespace: 'workspaceFiles', method: 'read', args: { workspaceId: 'known', path: 'hello.txt' },
    })).resolves.toEqual({ kind: 'text', path: 'hello.txt', content: 'hello\n' })
    await ctx.fiber.dispose()
  })

  it('lists immediate children and previews UTF-8 text and supported images', async () => {
    const { gateway, root } = await harness()
    await mkdir(join(root, 'src'))
    await writeFile(join(root, 'hello.txt'), '你好\n')
    await writeFile(join(root, 'pixel.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    const listing = await gateway.list('known', '')
    expect(listing.entries.map(entry => [entry.name, entry.kind])).toEqual([
      ['src', 'directory'], ['hello.txt', 'file'], ['pixel.png', 'file'],
    ])
    expect(await gateway.read('known', 'hello.txt')).toEqual({ kind: 'text', path: 'hello.txt', content: '你好\n' })
    expect(await gateway.read('known', 'pixel.png')).toMatchObject({ kind: 'image', mimeType: 'image/png' })
  })

  it('rejects absolute paths, parent traversal, unknown workspaces, and escaping symlinks', async () => {
    const { gateway, root, outside } = await harness()
    await writeFile(join(outside, 'secret.txt'), 'secret')
    await symlink(outside, join(root, 'escape'))
    await expect(gateway.list('known', '/tmp')).rejects.toThrow('must be relative')
    await expect(gateway.read('known', '../secret.txt')).rejects.toThrow('parent traversal')
    await expect(gateway.list('missing', '')).rejects.toThrow('unknown workspace')
    await expect(gateway.read('known', 'escape/secret.txt')).rejects.toThrow('escapes')
    expect((await gateway.list('known', '')).entries.some(entry => entry.name === 'escape')).toBe(false)
  })
})
