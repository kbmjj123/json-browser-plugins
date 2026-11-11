/**
 * Inject a component's stylesheet into the DOM root it is mounted in.
 *
 * Vue's `<style scoped>` is injected into `document.head`, which cannot pierce a
 * shadow boundary. Components rendered inside a shadow root (the viewer shell
 * and its children) must therefore inline their CSS and inject it into the root
 * node themselves: into a shadow root when mounted inside one, or into
 * `document.head` when mounted in the light DOM. The `:host` reset is only added
 * for shadow roots, so the host element starts from a clean baseline and page
 * styles cannot leak into the viewer.
 *
 * Safe to call from any component `onMounted` (idempotent per `id`).
 */
export function injectStylesIntoRoot(
  rootNode: Document | ShadowRoot,
  id: string,
  css: string,
  opts: { hostReset?: boolean } = {},
): void {
  const styleId = `${id}-styles`
  if (rootNode instanceof ShadowRoot) {
    if (rootNode.getElementById(styleId)) return
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = opts.hostReset ? `:host { all: initial }\n${css}` : css
    rootNode.appendChild(style)
  } else if (rootNode === document) {
    if (document.getElementById(styleId)) return
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = css
    document.head.appendChild(style)
  }
}
