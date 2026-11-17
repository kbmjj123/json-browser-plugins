import { defineConfig } from 'wxt'

/**
 * Store-listing notes (Chrome Web Store / Edge Add-ons / Firefox Add-ons):
 * - `version` is read from package.json (currently 1.0.1); keep it in sync when publishing.
 * - `name` / `description` come from the locale files under public/_locales/
 *   (en, zh, zh_CN, ja, fr, es, de) via __MSG_extName__ / __MSG_extDescription__.
 *   `description` (max 132 chars) is the short description shown in store search
 *   results — edit extDescription there, not in this file.
 * - `default_locale: 'en'`. zh_CN is Chrome's standard Simplified Chinese
 *   locale; the older bare `zh` folder is kept for backward compatibility.
 *   ja / fr / es / de cover Japanese, French, Spanish and German.
 * - Firefox targets Manifest V3 explicitly (`-b firefox --mv3`); WXT defaults
 *   Firefox to MV2, which cannot use `browser.action` or a service worker.
 *   `browser_specific_settings.gecko.id` is required for AMO signing, and
 *   `data_collection_permissions.required: ["none"]` has been mandatory for new
 *   AMO submissions since 2025-11-03. Proposed AMO slug: `jsontoolbox-cc` —
 *   keep it in sync with FIREFOX_REVIEW_URL in utils/constants.ts.
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
    // These matches trigger the "Read and change all your data on all websites"
    // install warning in Chrome and the broad-access warning in Firefox —
    // intentional and accepted. Explicit
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

    // Chrome-only floor: Firefox ignores `minimum_chrome_version`; its floor is
    // `gecko.strict_min_version` below. MV3 in Firefox starts at 109, but
    // 128.0 is the oldest non-ESR release still receiving updates.
    ...(browser !== 'firefox' && manifestVersion === 3
      ? { minimum_chrome_version: '116' }
      : {}),
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'jsontoolbox@jsontoolbox.cc',
              strict_min_version: '128.0',
              // No telemetry, analytics or remote scripts: nothing is sent to
              // us. Media previews are user-directed requests to URLs already
              // present in the JSON, not collection by the extension.
              data_collection_permissions: { required: ['none'] },
            },
          },
        }
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
