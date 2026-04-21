/**
 * Типизированный протокол postMessage между sandbox (code.ts) и UI (iframe).
 * Discriminated union по полю `type` обеспечивает exhaustiveness-проверку.
 * Запросы с ответом используют requestId (см. storage/client.ts).
 */

import type { SerializedNode } from './serialize'

// ——— UI → Sandbox ————————————————————————————————————————————

export type UiToSandbox =
  | { type: 'ui-ready' }
  | { type: 'request-selection' }
  | { type: 'run-audit'; scope: 'selection' | 'page' }
  | { type: 'export-frame'; nodeId: string; scale: number; requestId: string }
  | { type: 'jump-to-node'; nodeId: string }
  | { type: 'client-storage-get'; key: string; requestId: string }
  | { type: 'client-storage-set'; key: string; value: string | null; requestId: string }
  | { type: 'plugin-data-get'; key: string; requestId: string }
  | { type: 'plugin-data-set'; key: string; value: string; requestId: string }
  | { type: 'notify'; message: string; error?: boolean }
  | { type: 'close-plugin' }

// ——— Sandbox → UI ————————————————————————————————————————————

export interface SelectionPayload {
  nodes: SerializedNode[]
  selectionIds: string[]
}

export type SandboxToUi =
  | { type: 'init'; documentName: string; userName: string | null }
  | { type: 'selection-changed'; payload: SelectionPayload }
  | { type: 'audit-nodes'; payload: SelectionPayload }
  | { type: 'export-result'; requestId: string; nodeId: string; pngBase64: string }
  | { type: 'export-error'; requestId: string; nodeId: string; error: string }
  | { type: 'storage-value'; requestId: string; value: string | null }
  | { type: 'storage-ack'; requestId: string }

// ——— Хелперы ————————————————————————————————————————————

/** В sandbox (code.ts) — отправить сообщение в UI iframe. */
export function postToUi(msg: SandboxToUi): void {
  ;(globalThis as unknown as { figma: { ui: { postMessage: (m: unknown) => void } } }).figma.ui.postMessage(msg)
}

/** В UI (iframe) — отправить сообщение в sandbox. */
export function postToSandbox(msg: UiToSandbox): void {
  parent.postMessage({ pluginMessage: msg }, '*')
}
