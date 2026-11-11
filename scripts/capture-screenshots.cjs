/* Regenerate the five 1280x800 Chrome Web Store screenshots.
 *
 *   node scripts/capture-screenshots.cjs
 *
 * Requires a built .output/chrome-mv3 and a local Playwright + Chromium.
 * Notes for this machine: system Chrome 148 ignores --load-extension, and
 * Playwright passes --disable-extensions by default, so we use the bundled
 * chromium-1223 and strip that switch. The generated PNGs land in store-assets/.
 */
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('/Users/kbmjj123/.nvm/versions/node/v22.16.0/lib/node_modules/@playwright/cli/node_modules/playwright')

const ROOT = path.resolve(__dirname, '..')
const BUILD = path.join(ROOT, '.output/chrome-mv3')
const EXT = '/tmp/json-toolbox-shot-extension'
const OUT = path.join(ROOT, 'store-assets')
const PROFILE = '/tmp/json-toolbox-shot-profile'
const DEMO_ORIGIN = 'https://demo.jsontoolbox.cc'

const objectJson = fs.readFileSync(path.join(ROOT, 'demo/object-showcase.json'), 'utf8')
const tableJson = fs.readFileSync(path.join(ROOT, 'demo/table-orders.json'), 'utf8')
const OPTIONS = { indent: 2, theme: 'light', locale: 'en', view: 'both', auto: true, imagePreview: true }

fs.mkdirSync(OUT, { recursive: true })
fs.rmSync(PROFILE, { recursive: true, force: true })
// chrome.i18n follows the browser UI language, not Playwright's `locale`.
// Load a staged copy without the Chinese locales so screenshots fall back to
// default_locale (en); the real .output/ directory is never modified.
fs.rmSync(EXT, { recursive: true, force: true })
fs.cpSync(BUILD, EXT, { recursive: true })
fs.rmSync(path.join(EXT, '_locales', 'zh_CN'), { recursive: true, force: true })
fs.rmSync(path.join(EXT, '_locales', 'zh'), { recursive: true, force: true })
fs.mkdirSync(path.join(PROFILE, 'Default'), { recursive: true })
fs.writeFileSync(
  path.join(PROFILE, 'Default', 'Preferences'),
  JSON.stringify({ intl: { app_locale: 'en-US' } }),
)
process.env.LANG = 'en_US.UTF-8'

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
  console.log(`OK   ${name}  viewport=${size}  ${label}`)
}

async function main() {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false,
    executablePath: '/Users/kbmjj123/Library/Caches/ms-playwright/chromium-1223/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    locale: 'en-US',
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      '--enable-unsafe-extension-debugging',
      '--lang=en-US',
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
    console.log('results drawer:', await deepClick(overlay, 'button[aria-label="Results"]'))
    await overlay.waitForTimeout(600)
    await shot(overlay, 'screenshot-02-search.png', 'search + results drawer')

    // 3 + 4: array root -> table view, then the settings popover.
    await setPreview(preview, tableJson, `${DEMO_ORIGIN}/orders.json`)
    await preview.reload({ waitUntil: 'domcontentloaded' })
    await preview.waitForTimeout(1600)
    console.log('table view:', await deepClick(preview, '.je-mode-group button', 'Table'))
    await preview.waitForTimeout(900)
    console.log('sort amount:', await preview.evaluate(() => {
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
    await preview.waitForTimeout(600)
    await shot(preview, 'screenshot-03-table.png', 'table view + sorting')

    console.log('settings:', await deepClick(preview, '.settings-wrap button'))
    await preview.waitForTimeout(600)
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
