/* Generate the Chrome Web Store promo images.
 *
 *   node scripts/generate-promo-images.cjs
 *
 * Produces store-assets/promo-440x280.png and store-assets/marquee-1400x560.png.
 * The marquee embeds screenshot-01-auto-beautify.png, so run the screenshot
 * script first. No image library is needed: plain HTML/CSS rendered by Chromium.
 */
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('/Users/kbmjj123/.nvm/versions/node/v22.16.0/lib/node_modules/@playwright/cli/node_modules/playwright')

const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'store-assets')
const CHROMIUM = '/Users/kbmjj123/Library/Caches/ms-playwright/chromium-1223/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'

const iconUrl = `data:image/png;base64,${fs.readFileSync(path.join(ROOT, 'public/icon-128.png')).toString('base64')}`
const shotUrl = `data:image/png;base64,${fs.readFileSync(path.join(OUT, 'screenshot-01-auto-beautify.png')).toString('base64')}`

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"

const tileHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}html,body{margin:0;padding:0;width:440px;height:280px;overflow:hidden}
  .tile{position:relative;width:440px;height:280px;color:#fff;overflow:hidden;
    font-family:${FONT};
    background:linear-gradient(135deg,#081734 0%,#0B3C9B 52%,#0052D4 100%)}
  .tile:before{content:"{ }";position:absolute;right:-26px;top:-74px;font-size:250px;
    font-weight:800;letter-spacing:-34px;line-height:1;color:rgba(255,255,255,.07)}
  .glow{position:absolute;width:320px;height:320px;right:-90px;bottom:-180px;
    border-radius:50%;background:rgba(96,165,250,.22)}
  .inner{position:relative;z-index:2;height:100%;padding:28px;display:flex;flex-direction:column}
  .logo{width:62px;height:62px;padding:8px;border-radius:16px;background:#fff;
    box-shadow:0 10px 24px rgba(0,0,0,.28)}
  .brand{margin-top:auto;font-size:34px;font-weight:800;letter-spacing:-1.2px;line-height:1.05}
  .tag{margin-top:8px;font-size:15px;font-weight:500;color:rgba(255,255,255,.86)}
  .badge{margin-top:14px;align-self:flex-start;padding:5px 12px;border-radius:999px;
    border:1px solid rgba(255,255,255,.24);background:rgba(255,255,255,.14);
    font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase}
</style></head><body>
<div class="tile"><div class="glow"></div><div class="inner">
  <img class="logo" src="${iconUrl}" alt="">
  <div class="brand">JSON Toolbox</div>
  <div class="tag">JSON, made readable.</div>
  <div class="badge">Auto-beautify &nbsp;·&nbsp; Tree &nbsp;·&nbsp; Search</div>
</div></div></body></html>`

const marqueeHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}html,body{margin:0;padding:0;width:1400px;height:560px;overflow:hidden}
  .tile{position:relative;width:1400px;height:560px;color:#fff;overflow:hidden;
    font-family:${FONT};
    background:linear-gradient(115deg,#081734 0%,#0B3C9B 54%,#0052D4 100%)}
  .tile:before{content:"{ }";position:absolute;left:470px;top:-150px;font-size:520px;
    font-weight:800;letter-spacing:-70px;line-height:1;color:rgba(255,255,255,.05)}
  .glow{position:absolute;width:620px;height:620px;right:-180px;bottom:-360px;
    border-radius:50%;background:rgba(96,165,250,.20)}
  .left{position:absolute;left:64px;top:62px;width:530px;z-index:2}
  .logo{width:84px;height:84px;padding:11px;border-radius:20px;background:#fff;
    box-shadow:0 14px 32px rgba(0,0,0,.28)}
  .brand{margin-top:26px;font-size:56px;font-weight:800;letter-spacing:-2.2px;line-height:1.02}
  .tag{margin-top:16px;font-size:21px;line-height:1.5;font-weight:500;color:rgba(255,255,255,.86)}
  .chips{display:flex;gap:10px;margin-top:26px;flex-wrap:wrap}
  .chip{padding:7px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.24);
    background:rgba(255,255,255,.13);font-size:13px;font-weight:600}
  .shot{position:absolute;right:58px;top:50%;transform:translateY(-50%);width:690px;
    border:8px solid rgba(255,255,255,.96);border-radius:16px;overflow:hidden;
    box-shadow:0 34px 80px rgba(0,0,0,.45);z-index:2}
  .shot img{display:block;width:100%;height:auto}
</style></head><body>
<div class="tile"><div class="glow"></div>
  <div class="left">
    <img class="logo" src="${iconUrl}" alt="">
    <div class="brand">JSON Toolbox</div>
    <div class="tag">Turn raw JSON into a readable, searchable tree — automatically, in your browser.</div>
    <div class="chips">
      <span class="chip">Auto-beautify</span>
      <span class="chip">Tree &amp; Table</span>
      <span class="chip">100% local</span>
    </div>
  </div>
  <div class="shot"><img src="${shotUrl}" alt=""></div>
</div></body></html>`

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM })
  try {
    for (const [name, width, height, html] of [
      ['promo-440x280.png', 440, 280, tileHtml],
      ['marquee-1400x560.png', 1400, 560, marqueeHtml],
    ]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
      await page.setContent(html, { waitUntil: 'load' })
      await page.waitForTimeout(400)
      await page.screenshot({ path: path.join(OUT, name), animations: 'disabled' })
      console.log(`OK   ${name}  ${width}x${height}`)
      await page.close()
    }
  } finally {
    await browser.close()
  }
})().catch((err) => {
  console.error('FAILED:', err && err.stack ? err.stack : err)
  process.exit(1)
})
