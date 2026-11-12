/* Regenerate the five 1280x800 Chrome Web Store screenshots.
 *
 *   node scripts/capture-screenshots.cjs        # English -> store-assets/
 *   node scripts/capture-screenshots.cjs --zh   # Chinese -> store-assets/zh/
 *
 * Requires a built .output/chrome-mv3 and a local Playwright + Chromium.
 * Notes for this machine: system Chrome 148 ignores --load-extension, and
 * Playwright passes --disable-extensions by default, so we use the bundled
 * chromium-1223 and strip that switch.
 */
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('/Users/kbmjj123/.nvm/versions/node/v22.16.0/lib/node_modules/@playwright/cli/node_modules/playwright')

const ZH = process.argv.includes('--zh')
const ROOT = path.resolve(__dirname, '..')
const BUILD = path.join(ROOT, '.output/chrome-mv3')
const EXT = '/tmp/json-toolbox-shot-extension'
const OUT = path.join(ROOT, ZH ? 'store-assets/zh' : 'store-assets')
const PROFILE = '/tmp/json-toolbox-shot-profile'
const DEMO_ORIGIN = 'https://demo.jsontoolbox.cc'
const BROWSER_LOCALE = ZH ? 'zh-CN' : 'en-US'
const LABELS = {
  results: ZH ? '搜索结果' : 'Results',
  table: ZH ? '表格' : 'Table',
}

const objectJson = fs.readFileSync(path.join(ROOT, 'demo/object-showcase.json'), 'utf8')
const tableJson = fs.readFileSync(path.join(ROOT, 'demo/table-orders.json'), 'utf8')
const OPTIONS = { indent: 2, theme: 'light', locale: ZH ? 'zh' : 'en', view: 'both', auto: true, imagePreview: true }

fs.mkdirSync(OUT, { recursive: true })
fs.rmSync(PROFILE, { recursive: true, force: true })
// chrome.i18n follows the browser UI language, not Playwright's `locale`.
// For English screenshots, strip the Chinese locales from a staged copy so it
// falls back to default_locale (en); for Chinese screenshots keep them. The
// real .output/ directory is never modified.
fs.rmSync(EXT, { recursive: true, force: true })
fs.cpSync(BUILD, EXT, { recursive: true })
if (!ZH) {
  fs.rmSync(path.join(EXT, '_locales', 'zh_CN'), { recursive: true, force: true })
  fs.rmSync(path.join(EXT, '_locales', 'zh'), { recursive: true, force: true })
}
fs.mkdirSync(path.join(PROFILE, 'Default'), { recursive: true })
fs.writeFileSync(
  path.join(PROFILE, 'Default', 'Preferences'),
  JSON.stringify({ intl: { app_locale: BROWSER_LOCALE } }),
)
process.env.LANG = ZH ? 'zh_CN.UTF-8' : 'en_US.UTF-8'

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
  console.log(`OK   [${ZH ? 'zh' : 'en'}] ${name}  viewport=${size}  ${label}`)
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
    if (ZH) {
      // The built output still has the pre-fix template binding, so the popover
      // mounts with locale=en. Re-selecting 中文 in its own Language control
      // refreshes the panel translator without rebuilding the extension.
      console.log('refresh panel locale:', await preview.evaluate(() => {
        function walk(root) {
          for (const sel of root.querySelectorAll('select')) {
            if (Array.from(sel.options).some((o) => o.value === 'zh')) {
              sel.value = 'zh'
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
      }))
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
