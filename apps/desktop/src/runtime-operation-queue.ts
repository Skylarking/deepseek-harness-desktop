/** Serializes operations that replace or stop the single owned DSH runtime. */
export class RuntimeOperationQueue {
  private closed = false
  private tail: Promise<void> = Promise.resolve()

  public run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.closed) return Promise.reject(new Error('DSH Desktop is shutting down'))
    const result = this.tail.then(operation)
    this.tail = result.then(() => undefined, () => undefined)
    return result
  }

  /** Reject new work and resolve after the currently queued work reaches quiescence. */
  public async close(): Promise<void> {
    this.closed = true
    await this.tail
  }
}
