/**
 * The viewer stylesheet as a string.
 *
 * Content scripts run in an isolated world and the editor is mounted into a
 * nested shadow root, so the CSS must be inlined into that root instead of
 * being injected into the host page's <head>. Keeping the string in one place
 * means the copied editor components never leak `.je-*` styles onto arbitrary
 * pages.
 */
import cssText from './styles/index.css?inline'

export const editorCss: string = cssText
