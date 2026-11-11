/**
 * Large-file guard, mirrored from the main site's `useLargeFile` so the plugin
 * and the site agree on the same size rule. The site refuses content above this
 * limit and hands it to its dedicated Large JSON Explorer; the plugin shows an
 * inline banner that links there instead of freezing on the main thread.
 */
export const LARGE_FILE_MAX_BYTES = 5 * 1024 * 1024

/** UTF-8 byte length of a string. Uses Blob when available (native, fast). */
export function byteLength(text: string): number {
  if (typeof Blob !== 'undefined') return new Blob([text]).size
  let bytes = 0
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code < 0x80) bytes += 1
    else if (code < 0x800) bytes += 2
    else bytes += 3
  }
  return bytes
}

/** Human-readable size, e.g. "1.4 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`
}

/** The site's dedicated large-file viewer — the only page with worker-based
 *  streaming parse, record search and CSV export. */
export const LARGE_FILE_VIEWER_URL = 'https://jsontoolbox.cc/tools/view/large-json-viewer'
