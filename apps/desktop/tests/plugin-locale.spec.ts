import { describe, expect, it } from 'vitest'
import { pluginLocale } from '../src/plugin-locale.ts'

describe('plugin manager locale', () => {
  it('uses Chinese copy for Chinese system language tags', () => {
    const copy = pluginLocale('zh-Hans-CN')

    expect(copy.language).toBe('zh-CN')
    expect(copy.title).toBe('插件')
    expect(copy.summary(4, 1, 0)).toBe('4 个插件 · 1 个 skill 包 · 0 个其他包')
    expect(copy.toggleMessage('codex-pets', false)).toBe('停用 codex-pets？')
  })

  it('falls back to English for unsupported language tags', () => {
    expect(pluginLocale('ja-JP').language).toBe('en')
  })
})
