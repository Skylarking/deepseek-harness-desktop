/** Build the macOS icon from the exact whale mark used by the Web client. */
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const whaleSource = fileURLToPath(new URL('../../web/public/favicon.svg', import.meta.url))
const output = fileURLToPath(new URL('../build/icon.icns', import.meta.url))
const temporaryRoot = mkdtempSync(join(tmpdir(), 'dsh-desktop-icon-'))
const iconset = join(temporaryRoot, 'Whale.iconset')
const master = join(temporaryRoot, 'icon-1024.png')
const source = join(temporaryRoot, 'icon.svg')

const variants = [
  ['16', 'icon_16x16.png'],
  ['32', 'icon_16x16@2x.png'],
  ['32', 'icon_32x32.png'],
  ['64', 'icon_32x32@2x.png'],
  ['128', 'icon_128x128.png'],
  ['256', 'icon_128x128@2x.png'],
  ['256', 'icon_256x256.png'],
  ['512', 'icon_256x256@2x.png'],
  ['512', 'icon_512x512.png'],
  ['1024', 'icon_512x512@2x.png'],
] as const

try {
  mkdirSync(iconset)
  mkdirSync(fileURLToPath(new URL('../build', import.meta.url)), { recursive: true })
  const pathData = /<path id="path" d="([^"]+)"/u.exec(readFileSync(whaleSource, 'utf8'))?.[1]
  if (pathData === undefined) throw new Error(`Whale path not found in ${whaleSource}`)
  writeFileSync(source, `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect x="32" y="32" width="960" height="960" rx="220" fill="#f7f8fa" stroke="#dfe3ea" stroke-width="8"/>
  <path d="${pathData}" transform="translate(187 187) scale(13)" fill="#101114"/>
</svg>\n`)
  execFileSync('sips', ['-z', '1024', '1024', '-s', 'format', 'png', source, '--out', master], { stdio: 'ignore' })
  for (const [size, filename] of variants) {
    execFileSync('sips', ['-z', size, size, master, '--out', join(iconset, filename)], { stdio: 'ignore' })
  }
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', output], { stdio: 'inherit' })
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true })
}

console.log(`Built whale app icon: ${output}`)
