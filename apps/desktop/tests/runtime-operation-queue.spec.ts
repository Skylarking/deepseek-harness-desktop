import { describe, expect, it } from 'vitest'
import { RuntimeOperationQueue } from '../src/runtime-operation-queue.ts'

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

describe('RuntimeOperationQueue', () => {
  it('never overlaps runtime replacement operations', async () => {
    const queue = new RuntimeOperationQueue()
    const firstGate = deferred()
    const order: string[] = []
    const first = queue.run(async () => {
      order.push('first:start')
      await firstGate.promise
      order.push('first:end')
    })
    const second = queue.run(async () => {
      order.push('second:start')
      order.push('second:end')
    })

    await Promise.resolve()
    expect(order).toEqual(['first:start'])
    firstGate.resolve()
    await Promise.all([first, second])
    expect(order).toEqual(['first:start', 'first:end', 'second:start', 'second:end'])
  })

  it('continues with later work after one operation fails', async () => {
    const queue = new RuntimeOperationQueue()
    const failed = queue.run(async () => { throw new Error('mutation failed') })
    const next = queue.run(async () => 'restarted')

    await expect(failed).rejects.toThrow('mutation failed')
    await expect(next).resolves.toBe('restarted')
  })

  it('waits for queued work on close and rejects new operations', async () => {
    const queue = new RuntimeOperationQueue()
    const gate = deferred()
    const running = queue.run(async () => { await gate.promise })
    const closing = queue.close()

    await expect(queue.run(async () => undefined)).rejects.toThrow('shutting down')
    let closed = false
    void closing.then(() => { closed = true })
    await Promise.resolve()
    expect(closed).toBe(false)
    gate.resolve()
    await Promise.all([running, closing])
    expect(closed).toBe(true)
  })
})
