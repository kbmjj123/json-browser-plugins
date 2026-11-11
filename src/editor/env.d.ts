/// <reference types="vite/client" />

declare module '*.css?inline' {
  const css: string
  export default css
}

declare module '*.png?inline' {
  const src: string
  export default src
}
