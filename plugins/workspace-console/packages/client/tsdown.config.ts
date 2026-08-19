import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { clientBundle } from '../../../../packages/client/tsdown.client.ts'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-workspace-console'
const XTERM_CSS = '@xterm/xterm/css/xterm.css'
const XTERM_CSS_VIRTUAL_ID = '\0workspace-console-xterm-css.mjs'
const xtermStylesheet = createRequire(import.meta.url).resolve(XTERM_CSS)

const base = clientBundle(PACKAGE_NAME, ['lib/types/index.js', 'lib/types/invariant.js'])

/** Keep xterm's global stylesheet inside this external plugin's reversible lifecycle. */
export default ((options: Parameters<typeof base>[0]) => base(options).map(config => (
  config.platform !== 'browser'
    ? config
    : {
        ...config,
        plugins: [{
          name: 'workspace-console-xterm-css',
          resolveId(source: string) {
            return source === XTERM_CSS ? XTERM_CSS_VIRTUAL_ID : null
          },
          async load(id: string) {
            if (id !== XTERM_CSS_VIRTUAL_ID) return null
            this.addWatchFile(xtermStylesheet)
            const css = await readFile(xtermStylesheet, 'utf8')
            return [
              `const css = ${JSON.stringify(css)};`,
              `const tagId = ${JSON.stringify(`${PACKAGE_NAME}/xterm.css`)};`,
              "if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {",
              "  const tag = document.createElement('style');",
              `  tag.dataset.plugin = ${JSON.stringify(PACKAGE_NAME)};`,
              '  tag.dataset.pluginCss = tagId;',
              '  tag.textContent = css;',
              '  document.head.appendChild(tag);',
              '}',
              'export default {};',
            ].join('\n')
          },
        }, ...config.plugins ?? []],
      }
))) satisfies typeof base
