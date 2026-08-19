import { realpathSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { TypertGatewayService } from '@deepseek-ai/dsh-api-gateway'
import { TypertRegistry } from '@deepseek-ai/dsh-typert-registry'
import { afterEach, describe, expect, it, vi } from 'vitest'

const spawn = vi.hoisted(() => vi.fn())
vi.mock('node-pty', () => ({ spawn }))

import WorkspaceConsoleGateway from '../src/index.ts'
import { TYPERT_REMOTE } from '../src/remote.ts'
import { TYPERT } from '../src/typert.ts'

const roots: string[] = []
afterEach(async () => {
  spawn.mockReset()
  await Promise.all(roots.splice(0).map(async path => await rm(path, { recursive: true, force: true })))
})

function terminal() {
  const dataListeners = new Set<(data: string) => void>()
  const exitListeners = new Set<(event: { exitCode: number; signal?: number }) => void>()
  let exited = false
  const emitExit = (exitCode = 0, signal?: number): void => {
    if (exited) return
    exited = true
    for (const listener of exitListeners) listener({ exitCode, ...(signal === undefined ? {} : { signal }) })
  }
  const write = vi.fn()
  const resize = vi.fn()
  const kill = vi.fn(() => emitExit(0, 15))
  const handle = {
    pid: 123,
    write,
    resize,
    kill,
    onData(listener: (data: string) => void) {
      dataListeners.add(listener)
      return { dispose: () => dataListeners.delete(listener) }
    },
    onExit(listener: (event: { exitCode: number; signal?: number }) => void) {
      exitListeners.add(listener)
      return { dispose: () => exitListeners.delete(listener) }
    },
  }
  return {
    handle,
    write,
    resize,
    kill,
    emitData: (data: string) => { for (const listener of dataListeners) listener(data) },
    emitExit,
  }
}

async function harness() {
  const root = await mkdtemp(join(tmpdir(), 'dsh-workspace-console-'))
  roots.push(root)
  const ctx = new Context()
  ctx.provide('workspaceRegistry', { get: (id: string) => id === 'known' ? { path: root } : undefined } as never)
  const pty = terminal()
  spawn.mockReturnValueOnce(pty.handle)
  const gateway = new WorkspaceConsoleGateway(ctx, {
    shell: '/bin/zsh', shellArgs: ['-l'], graceMs: 100, maxOutputBytes: 4096,
    maxInputChars: 100, maxSessions: 2,
  })
  return { ctx, gateway, pty, root }
}

describe('WorkspaceConsoleGateway', () => {
  it('publishes matching descriptors and dispatches every Remote through the Host gateway', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-workspace-console-remote-'))
    roots.push(root)
    const ctx = new Context()
    ctx.provide('workspaceRegistry', { get: (id: string) => id === 'known' ? { path: root } : undefined } as never)
    const pty = terminal()
    spawn.mockReturnValueOnce(pty.handle)
    await ctx.plugin(TypertRegistry)
    await ctx.plugin(TypertGatewayService)
    ctx.typert.register(TYPERT)
    await ctx.plugin(WorkspaceConsoleGateway, {
      shell: '/bin/zsh', shellArgs: ['-l'], graceMs: 100, maxOutputBytes: 4096,
      maxInputChars: 100, maxSessions: 2,
    })

    expect(TYPERT.invocations.map(descriptor => descriptor.method)).toEqual(['open', 'write', 'read', 'resize', 'close'])
    expect(TYPERT_REMOTE.descriptors).toBe(TYPERT.invocations)
    const opened = await ctx.typertGateway.invoke({
      namespace: 'workspaceConsole', method: 'open', args: { workspaceId: 'known', cols: 80, rows: 24 },
    })
    expect(opened).toMatchObject({ sessionId: expect.any(String) })
    const sessionId = Reflect.get(opened as object, 'sessionId') as unknown
    await expect(ctx.typertGateway.invoke({
      namespace: 'workspaceConsole', method: 'write', args: { sessionId, data: 'pwd\r' },
    })).resolves.toBeUndefined()
    expect(pty.write).toHaveBeenCalledWith('pwd\r')
    pty.emitData('workspace % pwd\r\n')
    await expect(ctx.typertGateway.invoke({
      namespace: 'workspaceConsole', method: 'read', args: { sessionId, fromByte: 0 },
    })).resolves.toMatchObject({ text: 'workspace % pwd\r\n', exited: false })
    await expect(ctx.typertGateway.invoke({
      namespace: 'workspaceConsole', method: 'resize', args: { sessionId, cols: 120, rows: 40 },
    })).resolves.toBeUndefined()
    expect(pty.resize).toHaveBeenCalledWith(120, 40)
    await expect(ctx.typertGateway.invoke({
      namespace: 'workspaceConsole', method: 'close', args: { sessionId },
    })).resolves.toBeUndefined()
    expect(pty.kill).toHaveBeenCalledWith('SIGTERM')
    await ctx.fiber.dispose()
  })

  it('opens one persistent PTY and forwards input, output, and resize', async () => {
    const { gateway, pty, root } = await harness()
    const opened = await gateway.open('known', 80, 24)
    expect(spawn).toHaveBeenCalledWith('/bin/zsh', ['-l'], expect.objectContaining({
      cwd: realpathSync(root), rows: 24, cols: 80, name: 'xterm-256color',
    }))

    await gateway.write(opened.sessionId, 'cd /tmp\r')
    expect(pty.write).toHaveBeenCalledWith('cd /tmp\r')
    pty.emitData('prompt % cd /tmp\r\n')
    expect(gateway.read(opened.sessionId, 0)).toMatchObject({
      text: 'prompt % cd /tmp\r\n', nextOffset: 18, lossy: false, exited: false,
    })
    await gateway.resize(opened.sessionId, 120, 40)
    expect(pty.resize).toHaveBeenCalledWith(120, 40)
  })

  it('bounds retained UTF-8 output and reports terminal exit facts', async () => {
    const { gateway, pty } = await harness()
    const opened = await gateway.open('known', 80, 24)
    pty.emitData(`中文${'x'.repeat(5_000)}`)
    pty.emitExit(7)

    const read = gateway.read(opened.sessionId, 0)
    expect(Buffer.byteLength(read.text)).toBe(4_096)
    expect(read).toMatchObject({ nextOffset: 5_006, lossy: true, exited: true, exitCode: 7, signal: null })
  })

  it('closes sessions idempotently and unload terminates every PTY', async () => {
    const { ctx, gateway, pty } = await harness()
    const first = await gateway.open('known', 80, 24)
    await gateway.close(first.sessionId)
    await gateway.close(first.sessionId)
    expect(pty.kill).toHaveBeenCalledOnce()
    expect(pty.kill).toHaveBeenCalledWith('SIGTERM')

    const second = terminal()
    spawn.mockReturnValueOnce(second.handle)
    await gateway.open('known', 80, 24)
    await ctx.fiber.dispose()
    expect(second.kill).toHaveBeenCalledWith('SIGTERM')
  })

  it('rejects unknown workspaces, invalid dimensions, oversized input, and session overflow', async () => {
    const { gateway } = await harness()
    await expect(gateway.open('missing', 80, 24)).rejects.toThrow('unknown workspace')
    await expect(gateway.open('known', 0, 24)).rejects.toThrow('columns')
    const first = await gateway.open('known', 80, 24)
    await expect(gateway.write(first.sessionId, 'x'.repeat(101))).rejects.toThrow('input')
    const second = terminal()
    spawn.mockReturnValueOnce(second.handle)
    await gateway.open('known', 80, 24)
    await expect(gateway.open('known', 80, 24)).rejects.toThrow('session limit')
  })
})
