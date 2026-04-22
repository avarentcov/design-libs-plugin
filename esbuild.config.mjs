import { context, build } from 'esbuild'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = __dirname
const DIST = resolve(ROOT, 'dist')
const watch = process.argv.includes('--watch')

const common = {
  bundle: true,
  format: 'iife',
  logLevel: 'info',
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
}

// Sandbox бежит в старом парсере Figma (web plugin sandbox) —
// нужен es2017, чтобы убрать ?./?? и другие ES2020-фичи.
const sandboxOptions = {
  ...common,
  entryPoints: [resolve(ROOT, 'src/sandbox/code.ts')],
  outfile: resolve(DIST, 'code.js'),
  platform: 'browser',
  target: 'es2017',
}

// UI рендерится в обычном iframe (Chromium) — здесь es2020 ok.
const uiOptions = {
  ...common,
  entryPoints: [resolve(ROOT, 'src/ui/index.tsx')],
  outfile: resolve(DIST, 'ui.js'),
  platform: 'browser',
  target: 'es2020',
  define: {
    'process.env.NODE_ENV': watch ? '"development"' : '"production"',
  },
}

function runTailwind({ watch = false } = {}) {
  return new Promise((res, rej) => {
    const args = [
      'tailwindcss',
      '-i', resolve(ROOT, 'src/ui/globals.css'),
      '-o', resolve(DIST, 'ui.css'),
      '--minify',
    ]
    if (watch) args.push('--watch')
    const p = spawn('npx', args, { stdio: watch ? 'inherit' : 'pipe', cwd: ROOT })
    if (watch) { res(p); return }
    p.on('exit', (code) => code === 0 ? res() : rej(new Error('tailwind failed')))
  })
}

async function buildHtml() {
  const tpl = await readFile(resolve(ROOT, 'src/ui/index.html'), 'utf8')
  const js = await readFile(resolve(DIST, 'ui.js'), 'utf8')
  let css = ''
  try { css = await readFile(resolve(DIST, 'ui.css'), 'utf8') } catch {}
  // Callback-форма replace: строковая форма трактует `$&`/`$1` в js/css как
  // ссылки на match, что мусорит внутрь bundled React-кода. Функция отключает
  // эту подстановку.
  const html = tpl
    .replace('<!--INLINE_STYLE-->', () => `<style>${css}</style>`)
    .replace('<!--INLINE_SCRIPT-->', () => `<script>${js}</script>`)
  await writeFile(resolve(DIST, 'ui.html'), html, 'utf8')
}

await mkdir(DIST, { recursive: true })

if (watch) {
  const sandbox = await context(sandboxOptions)
  const ui = await context({
    ...uiOptions,
    plugins: [
      {
        name: 'inline-html',
        setup(b) {
          b.onEnd(async () => {
            try { await buildHtml() } catch (e) { console.error('[inline-html]', e) }
          })
        },
      },
    ],
  })
  void runTailwind({ watch: true })
  await Promise.all([sandbox.watch(), ui.watch()])
  console.log('🔄 watching…')
} else {
  await runTailwind()
  await build(sandboxOptions)
  await build(uiOptions)
  await buildHtml()
  console.log('✅ build complete → dist/')
}
