/** Exact-frame check for privileged desktop renderer bridges. */
export function isTrustedRendererFrame(actualUrl: string | undefined, expectedUrl: string): boolean {
  return actualUrl === expectedUrl
}

/** Accept a renderer document only when it shares the host-owned runtime origin. */
export function isTrustedRuntimeFrame(actualUrl: string | undefined, runtimeUrl: string | undefined): boolean {
  if (actualUrl === undefined || runtimeUrl === undefined) return false
  try {
    return new URL(actualUrl).origin === new URL(runtimeUrl).origin
  } catch {
    return false
  }
}
