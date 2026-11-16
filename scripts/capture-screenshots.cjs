/* Regenerate the five 1280x800 Chrome Web Store screenshots.
 *
 *   node scripts/capture-screenshots.cjs        # English  -> store-assets/
 *   node scripts/capture-screenshots.cjs --zh   # Chinese  -> store-assets/zh/
 *   node scripts/capture-screenshots.cjs --ja   # Japanese -> store-assets/ja/
 *   node scripts/capture-screenshots.cjs --fr   # French   -> store-assets/fr/
 *   node scripts/capture-screenshots.cjs --es   # Spanish  -> store-assets/es/
 *   node scripts/capture-screenshots.cjs --de   # German   -> store-assets/de/
 *
 * Requires a built .output/chrome-mv3 and a local Playwright + Chromium.
 * Notes for this machine: system Chrome 148 ignores --load-extension, and
 * Playwright passes --disable-extensions by default, so we use the bundled
 * chromium-1223 and strip that switch. The real .output/ is never modified.
 */
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('/Users/kbmjj123/.nvm/versions/node/v22.16.0/lib/node_modules/@playwright/cli/node_modules/playwright')

const LANG = process.argv.includes('--fr') ? 'fr'
  : process.argv.includes('--es') ? 'es'
  : process.argv.includes('--de') ? 'de'
  : process.argv.includes('--ja') ? 'ja'
  : process.argv.includes('--zh') ? 'zh' : 'en'
const ROOT = path.resolve(__dirname, '..')
const BUILD = path.join(ROOT, '.output/chrome-mv3')
const EXT = '/tmp/json-toolbox-shot-extension'
const OUT = path.join(ROOT, LANG === 'en' ? 'store-assets' : `store-assets/${LANG}`)
const PROFILE = '/tmp/json-toolbox-shot-profile'
const DEMO_ORIGIN = 'https://demo.jsontoolbox.cc'
const BROWSER_LOCALE = {
  en: 'en-US', zh: 'zh-CN', ja: 'ja-JP', fr: 'fr-FR', es: 'es-ES', de: 'de-DE',
}[LANG]
const ENV_LOCALE = {
  en: 'en_US.UTF-8', zh: 'zh_CN.UTF-8', ja: 'ja_JP.UTF-8',
  fr: 'fr_FR.UTF-8', es: 'es_ES.UTF-8', de: 'de_DE.UTF-8',
}[LANG]
const LABELS = {
  en: { results: 'Results', table: 'Table' },
  zh: { results: '搜索结果', table: '表格' },
  ja: { results: '検索結果', table: 'テーブル' },
  fr: { results: 'Résultats', table: 'Tableau' },
  es: { results: 'Resultados', table: 'Tabla' },
  de: { results: 'Ergebnisse', table: 'Tabelle' },
}[LANG]

const objectJson = fs.readFileSync(path.join(ROOT, 'demo/object-showcase.json'), 'utf8')
const tableJson = fs.readFileSync(path.join(ROOT, 'demo/table-orders.json'), 'utf8')
const OPTIONS = { indent: 2, theme: 'light', locale: LANG, view: 'both', auto: true, imagePreview: true }

fs.mkdirSync(OUT, { recursive: true })
fs.rmSync(PROFILE, { recursive: true, force: true })
// chrome.i18n follows the browser UI language, not Playwright's `locale`.
// English shots strip every non-English locale so the manifest falls back to
// default_locale (en); every non-English shot keeps all localizations.
fs.rmSync(EXT, { recursive: true, force: true })
fs.cpSync(BUILD, EXT, { recursive: true })
if (LANG === 'en') {
  for (const name of ['zh_CN', 'zh', 'ja', 'fr', 'es', 'de']) {
    fs.rmSync(path.join(EXT, '_locales', name), { recursive: true, force: true })
  }
}

function stagedJsFiles(stageDir) {
  return [
    path.join(stageDir, 'content-scripts/content.js'),
    ...fs.readdirSync(path.join(stageDir, 'chunks'))
      .filter((name) => name.endsWith('.js'))
      .map((name) => path.join(stageDir, 'chunks', name)),
  ]
}

/**
 * The built output predates src/editor/i18n/ja.ts, fr.ts, es.ts and de.ts, so
 * its translator would fall back to English for those locales. Patch ONLY the
 * staged copy: swap the bundled English dictionary values for the target ones,
 * scoped to the `const X={…}` object so unrelated keys are untouched.
 */
function injectDictionary(stageDir, lang) {
  const source = fs.readFileSync(path.join(ROOT, `src/editor/i18n/${lang}.ts`), 'utf8')
  const pairs = [...source.matchAll(/^\s{2}(\w+):\s*'((?:[^'\\]|\\.)*)'/gm)]
    .map(([, key, value]) => [key, value.replace(/\\'/g, "'")])
  if (pairs.length < 100) throw new Error(`Only parsed ${pairs.length} ${lang} messages`)

  for (const file of stagedJsFiles(stageDir)) {
    if (!fs.existsSync(file)) continue
    const code = fs.readFileSync(file, 'utf8')
    const marker = code.indexOf('={viewerTitle:"')
    if (marker === -1) continue
    const open = code.indexOf('{', marker)

    let depth = 0
    let inString = false
    let escaped = false
    let end = -1
    for (let i = open; i < code.length; i++) {
      const c = code[i]
      if (inString) {
        if (escaped) { escaped = false; continue }
        if (c === '\\') { escaped = true; continue }
        if (c === '"') inString = false
        continue
      }
      if (c === '"') { inString = true; continue }
      if (c === '{') depth++
      else if (c === '}') {
        depth--
        if (depth === 0) { end = i; break }
      }
    }
    if (end === -1) throw new Error(`Dictionary object not found in ${file}`)

    let dict = code.slice(open, end + 1)
    for (const [key, value] of pairs) {
      const re = new RegExp(`(\\b${key}:")((?:[^"\\\\]|\\\\.)*)(")`, 'g')
      dict = dict.replace(re, (_match, prefix, _old, suffix) =>
        prefix + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + suffix)
    }
    fs.writeFileSync(file, code.slice(0, open) + dict + code.slice(end + 1))
    console.log(`injected ${pairs.length} ${lang} strings into ${path.basename(file)}`)
  }
}

/** The built settings popover only lists en/zh/ja; add the new options to the
 * staged chunk so the Language control can refresh its translator. */
function injectLocaleOptions(stageDir) {
  const marker = 'w("option",{value:"ja"},"\\u65E5\\u672C\\u8A9E",-1)'
  const extra =
    ',w("option",{value:"fr"},"Français",-1)' +
    ',w("option",{value:"es"},"Español",-1)' +
    ',w("option",{value:"de"},"Deutsch",-1)'
  for (const file of stagedJsFiles(stageDir)) {
    if (!fs.existsSync(file)) continue
    const code = fs.readFileSync(file, 'utf8')
    if (!code.includes(marker)) continue
    fs.writeFileSync(file, code.replace(marker, marker + extra))
    console.log(`injected fr/es/de options into ${path.basename(file)}`)
  }
}

if (LANG !== 'en' && LANG !== 'zh') injectDictionary(EXT, LANG)
if (LANG === 'fr' || LANG === 'es' || LANG === 'de') injectLocaleOptions(EXT)

fs.mkdirSync(path.join(PROFILE, 'Default'), { recursive: true })
fs.writeFileSync(
  path.join(PROFILE, 'Default', 'Preferences'),
  JSON.stringify({ intl: { app_locale: BROWSER_LOCALE } }),
)
process.env.LANG = ENV_LOCALE

// Click an element even when it lives inside nested open shadow roots.
async function deepClick(page, selector, text) {
  return page.evaluate(({ sel, match }) => {
    function walk(root) {
      for (const el of root.querySelectorAll(sel)) {
        if (!match || (el.textContent || '').trim() === match) {
          el.click()
          return true
        }
      }
      for (const node of root.querySelectorAll('*')) {
        if (node.shadowRoot && walk(node.shadowRoot)) return true
      }
      return false
    }
    return walk(document)
  }, { sel: selector, match: text || null })
}

async function setPreview(page, text, url) {
  await page.evaluate(({ text, url }) => new Promise((resolve) => {
    chrome.storage.local.set({ lastPreview: { text, url, ts: Date.now() } }, resolve)
  }), { text, url })
}

async function shot(page, name, label) {
  await page.waitForTimeout(600)
  await page.screenshot({ path: path.join(OUT, name), animations: 'disabled' })
  const size = await page.evaluate(() => `${innerWidth}x${innerHeight}`)
  console.log(`OK   [${LANG}] ${name}  viewport=${size}  ${label}`)
}

async function sortByAmount(page) {
  console.log('sort amount:', await page.evaluate(() => {
    function walk(root) {
      for (const th of root.querySelectorAll('th')) {
        if (th.textContent.trim().includes('amount')) { th.click(); return true }
      }
      for (const n of root.querySelectorAll('*')) {
        if (n.shadowRoot && walk(n.shadowRoot)) return true
      }
      return false
    }
    return walk(document)
  }))
}

async function main() {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false,
    executablePath: '/Users/kbmjj123/Library/Caches/ms-playwright/chromium-1223/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    locale: BROWSER_LOCALE,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      '--enable-unsafe-extension-debugging',
      `--lang=${BROWSER_LOCALE}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  })

  try {
    let sw = ctx.serviceWorkers()[0]
    if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 20000 }).catch(() => null)
    let extId = sw ? new URL(sw.url()).host : null

    if (!extId) {
      const extPage = await ctx.newPage()
      await extPage.goto('chrome://extensions')
      await extPage.waitForTimeout(1500)
      extId = await extPage.evaluate(() => {
        const mgr = document.querySelector('extensions-manager')
        const list = mgr && mgr.shadowRoot && mgr.shadowRoot.querySelector('extensions-item-list')
        const item = list && list.shadowRoot && list.shadowRoot.querySelector('extensions-item')
        return item ? (item.id || item.getAttribute('id')) : null
      })
      await extPage.close()
    }
    if (!extId) throw new Error('Could not resolve the loaded extension id')
    console.log('extension id:', extId)

    const previewUrl = `chrome-extension://${extId}/lastPreview.html`
    const preview = await ctx.newPage()
    await preview.setViewportSize({ width: 1280, height: 800 })
    await preview.goto(previewUrl, { waitUntil: 'domcontentloaded' })
    await preview.waitForTimeout(900)
    await preview.evaluate((opts) => new Promise((resolve) => {
      chrome.storage.local.set({ 'jsontb:options:v1': opts }, resolve)
    }), OPTIONS)
    await setPreview(preview, objectJson, `${DEMO_ORIGIN}/showcase.json`)
    await preview.reload({ waitUntil: 'domcontentloaded' })
    await preview.waitForTimeout(1600)

    // 1 + 2: on-page overlay (an http document that returns plain-text JSON).
    const overlay = await ctx.newPage()
    await overlay.setViewportSize({ width: 1280, height: 800 })
    await overlay.route(`${DEMO_ORIGIN}/**`, (route) => route.fulfill({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      body: objectJson,
    }))
    await overlay.goto(`${DEMO_ORIGIN}/showcase.json`, { waitUntil: 'domcontentloaded' })
    await overlay.waitForSelector('#jsontb-root', { timeout: 20000 })
    await overlay.waitForTimeout(1800)
    await shot(overlay, 'screenshot-01-auto-beautify.png', 'automatic JSON overlay')

    const search = overlay.locator('input[type="search"]').first()
    await search.fill('photos', { timeout: 12000 })
    await overlay.waitForTimeout(1000)
    console.log('results drawer:', await deepClick(overlay, `button[aria-label="${LABELS.results}"]`))
    await overlay.waitForTimeout(600)
    await shot(overlay, 'screenshot-02-search.png', 'search + results drawer')

    // 3 + 4: array root -> table view, then the settings popover.
    await setPreview(preview, tableJson, `${DEMO_ORIGIN}/orders.json`)
    await preview.reload({ waitUntil: 'domcontentloaded' })
    await preview.waitForTimeout(1600)
    console.log('table view:', await deepClick(preview, '.je-mode-group button', LABELS.table))
    await preview.waitForTimeout(900)
    await sortByAmount(preview)
    await preview.waitForTimeout(600)
    await shot(preview, 'screenshot-03-table.png', 'table view + sorting')

    console.log('settings:', await deepClick(preview, '.settings-wrap button'))
    await preview.waitForTimeout(600)
    if (LANG !== 'en') {
      // The built output still has the pre-fix template binding, so the popover
      // mounts with locale=en. Re-selecting the target language in its own
      // Language control refreshes the panel translator without a rebuild.
      console.log('refresh panel locale:', await preview.evaluate((target) => {
        function walk(root) {
          for (const sel of root.querySelectorAll('select')) {
            if (Array.from(sel.options).some((o) => o.value === target)) {
              sel.value = target
              sel.dispatchEvent(new Event('change', { bubbles: true }))
              return true
            }
          }
          for (const n of root.querySelectorAll('*')) {
            if (n.shadowRoot && walk(n.shadowRoot)) return true
          }
          return false
        }
        return walk(document)
      }, LANG))
      await preview.waitForTimeout(700)
      // Only restore the table if that storage write actually reset the view;
      // re-sorting an intact table would flip ascending order to descending.
      const hasTable = await preview.evaluate(() => {
        function walk(root) {
          if (root.querySelector('table')) return true
          for (const n of root.querySelectorAll('*')) {
            if (n.shadowRoot && walk(n.shadowRoot)) return true
          }
          return false
        }
        return walk(document)
      })
      if (!hasTable) {
        console.log('restore table:', await deepClick(preview, '.je-mode-group button', LABELS.table))
        await preview.waitForTimeout(600)
        await sortByAmount(preview)
        await preview.waitForTimeout(500)
      }
    }
    await shot(preview, 'screenshot-04-settings.png', 'settings popover')

    // 5: image lightbox from the object-root showcase.
    await setPreview(preview, objectJson, `${DEMO_ORIGIN}/showcase.json`)
    await preview.reload({ waitUntil: 'domcontentloaded' })
    await preview.waitForTimeout(1700)
    console.log('open lightbox:', await deepClick(preview, 'img.je-insight-img'))
    await preview.waitForTimeout(900)
    await shot(preview, 'screenshot-05-lightbox.png', 'image lightbox')
  } finally {
    await ctx.close()
    fs.rmSync(PROFILE, { recursive: true, force: true })
    fs.rmSync(EXT, { recursive: true, force: true })
  }
}

main().catch((err) => {
  console.error('FAILED:', err && err.stack ? err.stack : err)
  process.exit(1)
})
