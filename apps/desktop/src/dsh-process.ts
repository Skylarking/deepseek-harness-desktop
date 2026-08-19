/**
 * Owns one DSH CLI child process. The CLI's URL line is its readiness protocol;
 * fixed sleeps can expose a window before Cordis and the API routes settle.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const READY_LINE = /^dsh web: (http:\/\/127\.0\.0\.1:\d+)(?:\s|$)/mu
const START_TIMEOUT_MS = 60_000
const STOP_TIMEOUT_MS = 7_000
const MAX_DIAGNOSTIC_LINES = 24

/** A DSH invocation independent of Electron's window lifecycle. */
export interface DshInvocation {
  args: readonly string[]
  cwd: string
  /** Test and embedding override; production uses the bounded default. */
  startTimeoutMs?: number
}

/** Runtime process state visible to the desktop host. */
export interface DshRuntimeState {
  url: string
}

/** Extract the canonical local URL from accumulated DSH stdout. */
export function parseReadyUrl(output: string): string | undefined {
  return READY_LINE.exec(output)?.[1]
}

/** Build the Node invocation required by DSH's loader and HMR services. */
export function dshNodeArgs(entry: string, args: readonly string[]): string[] {
  return ['--expose-internals', entry, ...args]
}

/** Resolve the built CLI in a checkout or the staged CLI in a packaged app. */
export async function resolveDshEntry(packaged: boolean, resourcesPath: string): Promise<string> {
  const override = process.env.DSH_DESKTOP_RUNTIME_ENTRY
  const entry = override !== undefined && override !== ''
    ? override
    : packaged
      ? join(resourcesPath, 'dsh-runtime', 'lib', 'bin.js')
      : fileURLToPath(new URL('../.runtime/lib/bin.js', import.meta.url))
  await access(entry)
  return entry
}

function diagnostic(lines: readonly string[]): string {
  return lines.slice(-MAX_DIAGNOSTIC_LINES).join('\n').trim()
}

/** Retains only startup diagnostics and releases them as soon as startup settles. */
export class DshStartupCapture {
  private active = true
  private readonly output: string[] = []
  private stdout = ''

  public appendStdout(chunk: string): string | undefined {
    if (!this.active) return undefined
    this.stdout += chunk
    this.output.push(...chunk.split(/\r?\n/u).filter(Boolean))
    return parseReadyUrl(this.stdout)
  }

  public appendStderr(chunk: string): void {
    if (!this.active) return
    this.output.push(...chunk.split(/\r?\n/u).filter(Boolean))
  }

  public diagnostic(): string {
    return diagnostic(this.output)
  }

  public close(): void {
    this.active = false
    this.stdout = ''
    this.output.length = 0
  }
}

/** Supervises a DSH web process and reaches quiescence before disposal returns. */
export class DshProcess {
  private child: ChildProcessWithoutNullStreams | undefined
  private stopping: Promise<void> | undefined

  public constructor(
    private readonly entry: string,
    private readonly invocation: DshInvocation,
  ) {}

  /** Start DSH and resolve only after its Loader-settled readiness line. */
  public async start(): Promise<DshRuntimeState> {
    if (this.child !== undefined) throw new Error('DSH Desktop runtime is already running')
    const child = spawn(process.execPath, dshNodeArgs(this.entry, this.invocation.args), {
      cwd: this.invocation.cwd,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    child.stdin.end()
    this.child = child

    return await new Promise<DshRuntimeState>((resolve, reject) => {
      const capture = new DshStartupCapture()
      let settled = false
      const finish = (callback: () => void): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        capture.close()
        callback()
      }
      const fail = (error: Error, stopChild = false): void => {
        finish(() => {
          if (!stopChild) {
            reject(error)
            return
          }
          void this.stop().then(() => { reject(error) }, () => { reject(error) })
        })
      }
      const startTimeoutMs = this.invocation.startTimeoutMs ?? START_TIMEOUT_MS
      const timer = setTimeout(() => {
        const detail = capture.diagnostic()
        fail(new Error(`DSH did not become ready within ${String(startTimeoutMs / 1000)} seconds${detail === '' ? '' : `:\n${detail}`}`), true)
      }, startTimeoutMs)

      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', (chunk: string) => {
        const url = capture.appendStdout(chunk)
        if (url !== undefined) finish(() => { resolve({ url }) })
      })
      child.stderr.on('data', (chunk: string) => {
        capture.appendStderr(chunk)
      })
      child.once('error', (error) => {
        fail(new Error(`Failed to launch DSH: ${error.message}`, { cause: error }), true)
      })
      child.once('exit', (code, signal) => {
        this.child = undefined
        const detail = capture.diagnostic()
        fail(new Error(`DSH exited before it became ready (code=${String(code)}, signal=${String(signal)})${detail === '' ? '' : `:\n${detail}`}`))
      })
    })
  }

  /** Request graceful shutdown, then force only this owned child if it misses the bound. */
  public async stop(): Promise<void> {
    if (this.stopping !== undefined) {
      await this.stopping
      return
    }
    const child = this.child
    if (child === undefined) return
    this.stopping = new Promise((resolve) => {
      let settled = false
      const finish = (): void => {
        if (settled) return
        settled = true
        clearTimeout(forceTimer)
        this.child = undefined
        this.stopping = undefined
        resolve()
      }
      const forceTimer = setTimeout(() => {
        child.kill('SIGKILL')
      }, STOP_TIMEOUT_MS)
      child.once('exit', finish)
      if (!child.kill('SIGTERM')) finish()
    })
    await this.stopping
  }
}
