import { defineBackground } from 'wxt/utils/define-background'
import { browser } from 'wxt/browser'

/**
 * Toolbar-icon behavior: a click opens a new tab showing the most recently
 * previewed JSON. There is no action popup (it would suppress `onClicked`), so
 * the click event fires and we open the page here.
 */
export default defineBackground(() => {
  browser.action.onClicked.addListener(() => {
    const getURL = browser.runtime.getURL as (path: string) => string
    browser.tabs.create({ url: getURL('lastPreview.html') })
  })
})
