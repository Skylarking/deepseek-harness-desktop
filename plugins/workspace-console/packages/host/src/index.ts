/** Persistent PTY Remote for registered workspace directories. */

import { randomUUID } from 'node:crypto'
import { realpath } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import { spawn, type IDisposable, type IPty } from 'node-pty'
import type {} from 'zod'
import {
  WorkspaceConsoleSessionId,
  type WorkspaceConsoleOpenResult,
  type WorkspaceConsoleReadResult,
} from './types.ts'

export type * from './types.ts'

/** Validated resource bounds for the workspace terminal plugin. */
export interface Config {
  /** Terminal shell executable. */
  shell: string
  /** Arguments passed to the terminal shell. */
  shellArgs: string[]
  /** TERM-to-KILL cleanup grace in milliseconds. */
  graceMs: number
  /** Maximum UTF-8 bytes retained in each session's output tail. */
  maxOutputBytes: number
  /** Maximum characters accepted by one input call. */
  maxInputChars: number
  /** Maximum combined pending and published terminal sessions. */
  maxSessions: number
}

interface SessionRecord {
  readonly handle: IPty
  readonly output: OutputTail
  readonly dataSubscription: IDisposable
  exitSubscription?: IDisposable
  readonly exited: Promise<void>
  outcome: { exitCode: number | null; signal: string | null } | undefined
}

interface PendingOpen {
  readonly settled: Promise<void>
}

class OutputTail {
  private readonly chunks: Buffer[] = []
  private retainedBytes = 0
  private total = 0

  constructor(private readonly maxBytes: number) {}

  append(text: string): void { this.appendText(text) }

  read(fromByte: number): Pick<WorkspaceConsoleReadResult, 'text' | 'nextOffset' | 'lossy'> {
    if (!Number.isSafeInteger(fromByte) || fromByte < 0 || fromByte > this.total) {
      throw new Error('terminal output offset must be a non-negative prior offset')
    }
    const retained = Buffer.concat(this.chunks, this.retainedBytes)
    const windowStart = this.total - retained.byteLength
    const lossy = fromByte < windowStart
    const start = lossy ? 0 : fromByte - windowStart
    return { text: retained.subarray(start).toString('utf8'), nextOffset: this.total, lossy }
  }

  private appendText(text: string): void {
    if (text === '') return
    const chunk = Buffer.from(text, 'utf8')
    this.chunks.push(chunk)
    this.retainedBytes += chunk.byteLength
    this.total += chunk.byteLength
    while (this.retainedBytes > this.maxBytes) {
      const first = this.chunks[0]
      if (first === undefined) throw new Error('workspace console output tail lost its retained chunk')
      const excess = this.retainedBytes - this.maxBytes
      if (first.byteLength <= excess) {
        this.chunks.shift()
        this.retainedBytes -= first.byteLength
      } else {
        let start = excess
        while (start < first.byteLength && ((first[start] ?? 0) & 0xc0) === 0x80) start += 1
        this.chunks[0] = first.subarray(start)
        this.retainedBytes -= start
      }
    }
  }
}

/** Remote-only service owning persistent human workspace terminals. */
export class WorkspaceConsoleGateway extends TypertRemoteService {
  static inject = ['workspaceRegistry']
  static Config: z<Config> = z.object({
    shell: z.string().default('/bin/zsh'),
    shellArgs: z.array(z.string()).default(['-l']),
    graceMs: z.natural().min(100).default(2_000),
    maxOutputBytes: z.natural().min(1024).default(256 * 1024),
    maxInputChars: z.natural().min(1).default(64 * 1024),
    maxSessions: z.natural().min(1).default(8),
  })

  private readonly sessions = new Map<WorkspaceConsoleSessionId, SessionRecord>()
  private readonly pendingOpens = new Set<PendingOpen>()
  private disposing = false

  constructor(ctx: Context, private readonly config: Config) {
    super(ctx, 'workspaceConsole')
    ctx.effect(() => () => this.disposeAll(), 'workspace-console PTY teardown')
  }

  /**
   * Allocate one persistent terminal rooted at a registered workspace.
   * @param workspaceId - Registered workspace id.
   * @param cols - Initial terminal columns.
   * @param rows - Initial terminal rows.
   * @returns the allocated terminal identity.
   */
  @Remote('open')
  async open(workspaceId: string, cols: number, rows: number): Promise<WorkspaceConsoleOpenResult> {
    this.assertActive()
    this.assertDimensions(cols, rows)
    if (this.sessions.size + this.pendingOpens.size >= this.config.maxSessions) throw new Error('workspace console session limit reached')
    const workspace = this.ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
    if (workspace === undefined) throw new Error(`unknown workspace '${workspaceId}'`)
    const allocation = this.allocate(workspace.path, cols, rows)
    const pending: PendingOpen = { settled: allocation.then(() => {}, () => {}) }
    this.pendingOpens.add(pending)
    try {
      return await allocation
    } finally {
      this.pendingOpens.delete(pending)
    }
  }

  private async allocate(path: string, cols: number, rows: number): Promise<WorkspaceConsoleOpenResult> {
    const cwd = await realpath(path)
    this.assertActive()
    const handle = spawn(this.config.shell, this.config.shellArgs, {
      cwd,
      cols,
      rows,
      name: 'xterm-256color',
      env: Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)),
    })
    const sessionId = WorkspaceConsoleSessionId(`workspace-console-${randomUUID()}`)
    const output = new OutputTail(this.config.maxOutputBytes)
    const exit = Promise.withResolvers<void>()
    const record: SessionRecord = {
      handle,
      output,
      dataSubscription: handle.onData(data => output.append(data)),
      exited: exit.promise,
      outcome: undefined,
    }
    record.exitSubscription = handle.onExit(({ exitCode, signal }) => {
      record.outcome = { exitCode, signal: signal === undefined ? null : String(signal) }
      exit.resolve()
    })
    this.sessions.set(sessionId, record)
    return { sessionId }
  }

  /**
   * Write raw keyboard data into a terminal.
   * @param sessionId - terminal identity returned by {@link open}.
   * @param data - raw xterm input without newline conversion.
   */
  @Remote('write')
  async write(sessionId: WorkspaceConsoleSessionId, data: string): Promise<void> {
    if (data.length === 0 || data.length > this.config.maxInputChars || data.includes('\0')) {
      throw new Error(`terminal input must contain 1-${this.config.maxInputChars} characters without NUL`)
    }
    this.session(sessionId).handle.write(data)
  }

  /**
   * Read terminal output after a caller-owned byte offset.
   * @param sessionId - terminal identity returned by {@link open}.
   * @param fromByte - byte offset returned by the previous read.
   * @returns incremental terminal output and current exit state.
   */
  @Remote('read')
  read(sessionId: WorkspaceConsoleSessionId, fromByte: number): WorkspaceConsoleReadResult {
    const record = this.session(sessionId)
    return {
      ...record.output.read(fromByte),
      exited: record.outcome !== undefined,
      exitCode: record.outcome?.exitCode ?? null,
      signal: record.outcome?.signal ?? null,
    }
  }

  /**
   * Resize a live terminal.
   * @param sessionId - terminal identity returned by {@link open}.
   * @param cols - terminal columns.
   * @param rows - terminal rows.
   */
  @Remote('resize')
  async resize(sessionId: WorkspaceConsoleSessionId, cols: number, rows: number): Promise<void> {
    this.assertDimensions(cols, rows)
    this.session(sessionId).handle.resize(cols, rows)
  }

  /**
   * Close one terminal. Repeating a close is a no-op.
   * @param sessionId - terminal identity returned by {@link open}.
   */
  @Remote('close')
  async close(sessionId: WorkspaceConsoleSessionId): Promise<void> {
    const record = this.sessions.get(sessionId)
    if (record === undefined) return
    this.sessions.delete(sessionId)
    await this.terminate(record)
  }

  private session(sessionId: WorkspaceConsoleSessionId): SessionRecord {
    const record = this.sessions.get(sessionId)
    if (record === undefined) throw new Error(`unknown workspace console session '${sessionId}'`)
    return record
  }

  private assertActive(): void {
    if (this.disposing) throw new Error('workspace console is disposing')
  }

  private assertDimensions(cols: number, rows: number): void {
    if (!Number.isInteger(cols) || cols < 1 || cols > 1000) throw new Error('terminal columns must be an integer between 1 and 1000')
    if (!Number.isInteger(rows) || rows < 1 || rows > 500) throw new Error('terminal rows must be an integer between 1 and 500')
  }

  private async disposeAll(): Promise<void> {
    this.disposing = true
    const pending = [...this.pendingOpens]
    await Promise.all(pending.map(open => open.settled))
    const records = [...this.sessions.values()]
    this.sessions.clear()
    await Promise.all(records.map(async record => await this.terminate(record)))
  }

  private async terminate(record: SessionRecord): Promise<void> {
    if (record.outcome === undefined) {
      record.handle.kill('SIGTERM')
      const graceful = await Promise.race([
        record.exited.then(() => true),
        new Promise<false>(resolvePromise => setTimeout(() => resolvePromise(false), this.config.graceMs)),
      ])
      if (!graceful && record.outcome === undefined) {
        record.handle.kill('SIGKILL')
        await record.exited
      }
    }
    record.dataSubscription.dispose()
    record.exitSubscription?.dispose()
  }
}

export default WorkspaceConsoleGateway
