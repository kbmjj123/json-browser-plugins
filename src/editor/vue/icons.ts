/**
 * Inline SVG icons. Kept as strings so the package needs no icon runtime,
 * no webfont, and no network request.
 */

const wrap = (path: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`

export const icons = {
  chevronRight: wrap('<path d="m9 18 6-6-6-6"/>'),
  alignLeft: wrap('<path d="M21 6H3"/><path d="M15 12H3"/><path d="M17 18H3"/>'),
  minimize: wrap('<path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M3 21l7-7"/>'),
  copy: wrap(
    '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'
  ),
  check: wrap('<path d="M20 6 9 17l-5-5"/>'),
  search: wrap('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'),
  expand: wrap('<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>'),
  collapse: wrap('<path d="m7 9 5 5 5-5"/><path d="m7 15 5-5 5 5"/>'),
  braces: wrap(
    '<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1"/><path d="M16 21h1a2 2 0 0 0 2-2v-5a2 2 0 0 1 2-2 2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>'
  ),
  brackets: wrap('<path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/><path d="M8 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3"/>'),
  alert: wrap(
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>'
  ),
  x: wrap('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  undo: wrap('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11"/>'),
  redo: wrap('<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5 5.5 5.5 0 0 0 9.5 20H13"/>'),
  dots: wrap('<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>'),
  chevronUp: wrap('<path d="m18 15-6-6-6 6"/>'),
  chevronDown: wrap('<path d="m6 9 6 6 6-6"/>'),
  chevronLeft: wrap('<path d="m15 18-6-6 6-6"/>'),
  list: wrap('<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>'),
  download: wrap('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>'),
  external: wrap('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/>'),
  mail: wrap('<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>'),
  coffee: wrap('<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h8Z"/><path d="M18 8h2a2 2 0 0 1 0 4h-2"/>'),
} as const

export type IconName = keyof typeof icons
