import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DshProcess, DshStartupCapture, dshNodeArgs, parseReadyUrl } from '../src/dsh-process.ts'

describe('dshNodeArgs', () => {
  it('enables Node internals before loading the DSH entry', () => {
    expect(dshNodeArgs('/runtime/bin.js', ['web', '--port', '0']))
      .toEqual(['--expose-internals', '/runtime/bin.js', 'web', '--port', '0'])
  })
})

describe('parseReadyUrl', () => {
  it('reads the Loader-settled loopback URL', () => {
    expect(parseReadyUrl('[plugin] loaded\ndsh web: http://127.0.0.1:43127\n'))
      .toBe('http://127.0.0.1:43127')
  })

  it('ignores a URL that is not the readiness line', () => {
    expect(parseReadyUrl('open http://127.0.0.1:3080 while waiting'))
      .toBeUndefined()
  })

  it('accepts a readiness line split across stream chunks after accumulation', () => {
    const accumulated = 'dsh web: http://127.0.0.1:' + '51234\n'
    expect(parseReadyUrl(accumulated)).toBe('http://127.0.0.1:51234')
  })
})

describe('DshStartupCapture', () => {
  it('releases diagnostics and ignores all output after startup settles', () => {
    const capture = new DshStartupCapture()
    expect(capture.appendStdout('booting\ndsh web: http://127.0.0.1:43127\n'))
      .toBe('http://127.0.0.1:43127')
    capture.close()
    capture.appendStdout('x'.repeat(100_000))
    capture.appendStderr('late plugin log')
    expect(capture.diagnostic()).toBe('')
  })
})

describe('DshProcess startup ownership', () => {
  it('terminates its child before a startup timeout rejects', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-desktop-timeout-'))
    const entry = join(root, 'hang.mjs')
    const pidFile = join(root, 'pid')
    await writeFile(entry, 'import { writeFileSync } from \'node:fs\'\nwriteFileSync(process.argv[2], String(process.pid))\nsetInterval(() => {}, 1000)\n')
    const runtime = new DshProcess(entry, {
      args: [pidFile],
      cwd: root,
      startTimeoutMs: 500,
    })

    await expect(runtime.start()).rejects.toThrow('did not become ready')
    const pid = Number(await readFile(pidFile, 'utf8'))
    expect(() => process.kill(pid, 0)).toThrow()
  })
})
