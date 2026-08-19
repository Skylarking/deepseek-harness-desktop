import { describe, expect, it } from 'vitest'
import { isTrustedRendererFrame, isTrustedRuntimeFrame } from '../src/window-security.ts'

describe('privileged renderer frame validation', () => {
  const expected = 'file:///Applications/DeepSeek%20Harness.app/Contents/Resources/app.asar/lib/renderer/plugins.html'

  it('accepts only the exact local plugin-manager document', () => {
    expect(isTrustedRendererFrame(expected, expected)).toBe(true)
  })

  it.each([
    undefined,
    'https://example.com/plugins.html',
    `${expected}?redirect=https://example.com`,
    'file:///tmp/plugins.html',
  ])('rejects an untrusted frame URL: %s', (actual) => {
    expect(isTrustedRendererFrame(actual, expected)).toBe(false)
  })
})

describe('runtime renderer origin validation', () => {
  const runtimeUrl = 'http://127.0.0.1:53127/'

  it('accepts routes and queries at the host-owned runtime origin', () => {
    expect(isTrustedRuntimeFrame('http://127.0.0.1:53127/settings?tab=plugins', runtimeUrl)).toBe(true)
  })

  it.each([
    undefined,
    'data:text/html,loading',
    'http://127.0.0.1:53128/',
    'https://127.0.0.1:53127/',
    'not a url',
  ])('rejects a frame outside the current runtime origin: %s', (actual) => {
    expect(isTrustedRuntimeFrame(actual, runtimeUrl)).toBe(false)
  })
})
