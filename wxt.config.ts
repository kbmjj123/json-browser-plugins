import { defineConfig } from 'wxt'

/**
 * Store-listing notes (Chrome Web Store / Edge Add-ons):
 * - `version` is read from package.json (1.0.0); keep it in sync when publishing.
 * - `name` / `description` come from the locale files under public/_locales/
 *   (en, zh, zh_CN) via __MSG_extName__ / __MSG_extDescription__.
 *   `description` (max 132 chars) is the short description shown in store search
 *   results — edit extDescription there, not in this file.
 * - `default_locale: 'en'`. zh_CN is Chrome's standard Simplified Chinese
 *   locale; the older bare `zh` folder is kept for backward compatibility.
 * - Dashboard-only fields: Homepage https://jsontoolbox.cc, support URL
 *   https://github.com/kbmjj123/json-browser-plugins/issues, privacy policy URL,
 *   category "Developer Tools", screenshots and promo images.
 */
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],

  manifest: ({ browser, manifestVersion }) => ({
    name: '__MSG_extName__',
    short_name: 'JSON Toolbox',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    homepage_url: 'https://jsontoolbox.cc',

    // Permission justification (paste into the store's permission reasons):
    // `storage` — saves the six viewer settings AND the most recently previewed
    //   JSON text (with its source URL + timestamp) in storage.local, so the
    //   toolbar button can reopen it in a dedicated tab. Local only, no upload.
    // Content scripts are generated from entrypoints/content.ts with
    //   matches: ['<all_urls>', 'file:///*']. Chrome has no API to inject based
    //   on a response's Content-Type, so automatic JSON detection needs the
    //   broad match; the script exits silently with zero DOM changes on any page
    //   that is not a lone <pre> holding valid JSON. file:// support also
    //   requires the user to enable "Allow access to file URLs" manually.
    // These matches trigger Chrome's "Read and change all your data on all
    // websites" install warning — intentional and accepted. Explicit
    // `host_permissions` are NOT required for content-script injection and are
    // deliberately not declared. No remote code and no analytics; the only
    // third-party requests are media URLs found in the JSON itself (toggleable).
    permissions: ['storage'],

    // No default_popup: the toolbar icon opens the last-preview tab (handled in
    // entrypoints/background.ts via action.onClicked — a popup would suppress
    // onClicked). Declaring `action` here guarantees the toolbar action exists
    // so onClicked fires reliably.
    action: {},

    icons: {
      16: '/icon-16.png',
      32: '/icon-32.png',
      48: '/icon-48.png',
      128: '/icon-128.png', // also the 128x128 Chrome Web Store icon
    },

    ...(manifestVersion === 3 ? { minimum_chrome_version: '116' } : {}),
    // Firefox scaffold only — v1 builds `-b chrome` exclusively.
    ...(browser === 'firefox'
      ? { browser_specific_settings: { gecko: { id: 'jsontoolbox@jsontoolbox.cc' } } }
      : {}),
  }),

  vite: () => ({
    resolve: {
      // /wc bundles Vue via createApp; a second Vue instance would silently
      // break provide/inject and reactivity.
      dedupe: ['vue'],
    },
  }),
})
