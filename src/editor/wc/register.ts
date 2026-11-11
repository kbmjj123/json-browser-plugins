/**
 * Entry point for the CDN bundle: registers `<json-editor>` as a side effect
 * so a single `<script src="...">` is enough. NOT used by the extension —
 * content scripts run in an isolated world where `customElements` is null.
 *
 * Import `registerJsonEditor` from `./element` instead if you want to choose
 * the tag name or control when registration happens.
 */
import { registerJsonEditor, JsonEditorElement } from './element'

registerJsonEditor()

export { registerJsonEditor, JsonEditorElement }
export { defineJsonEditor } from './defineJsonEditor'
export type {
  JsonEditorInstance,
  JsonEditorOptions,
  JsonEditorErrorInfo,
  JsonEditorSelectInfo,
  JsonEditorEvent,
} from './defineJsonEditor'
