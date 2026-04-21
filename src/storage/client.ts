/**
 * Async-обёртка над sandbox-протоколом для clientStorage и pluginData.
 * Использует requestId → Promise map.
 */
import { postToSandbox, type SandboxToUi } from '../shared/messages'

type Pending = { resolve: (v: string | null) => void; reject: (err: Error) => void }
const pending = new Map<string, Pending>()

export function installStorageBridge(): () => void {
  function onMessage(e: MessageEvent) {
    const msg = e.data?.pluginMessage as SandboxToUi | undefined
    if (!msg) return
    if (msg.type === 'storage-value') {
      const p = pending.get(msg.requestId)
      if (p) { pending.delete(msg.requestId); p.resolve(msg.value) }
    } else if (msg.type === 'storage-ack') {
      const p = pending.get(msg.requestId)
      if (p) { pending.delete(msg.requestId); p.resolve(null) }
    }
  }
  window.addEventListener('message', onMessage)
  return () => window.removeEventListener('message', onMessage)
}

function nextId(): string {
  return `r${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function request<T>(send: (id: string) => void): Promise<T> {
  const id = nextId()
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: string | null) => void, reject })
    try { send(id) } catch (e) { pending.delete(id); reject(e instanceof Error ? e : new Error(String(e))) }
    setTimeout(() => {
      if (pending.has(id)) { pending.delete(id); reject(new Error('Sandbox не ответил за 5 с')) }
    }, 5000)
  })
}

// ——— clientStorage (per-user) ————————————————————————————————

export function getClientStorage(key: string): Promise<string | null> {
  return request<string | null>((requestId) =>
    postToSandbox({ type: 'client-storage-get', key, requestId }),
  )
}

export function setClientStorage(key: string, value: string | null): Promise<void> {
  return request<void>((requestId) =>
    postToSandbox({ type: 'client-storage-set', key, value, requestId }),
  )
}

// ——— pluginData (document-level, синкается с другими пользователями файла) —

export function getPluginData(key: string): Promise<string | null> {
  return request<string | null>((requestId) =>
    postToSandbox({ type: 'plugin-data-get', key, requestId }),
  )
}

export function setPluginData(key: string, value: string): Promise<void> {
  return request<void>((requestId) =>
    postToSandbox({ type: 'plugin-data-set', key, value, requestId }),
  )
}

// ——— JSON-хелперы ————————————————————————————————————————————

export async function readJson<T>(get: (k: string) => Promise<string | null>, key: string, fallback: T): Promise<T> {
  const raw = await get(key)
  if (!raw) return fallback
  try { return JSON.parse(raw) as T } catch { return fallback }
}

export function writeJson(set: (k: string, v: string) => Promise<void>, key: string, value: unknown): Promise<void> {
  return set(key, JSON.stringify(value))
}

// ——— Ключи ——————————————————————————————————————————————————

export const STORAGE_KEYS = {
  settings: 'dli.settings.v1',
  apiKey: 'dli.apiKey.v1',
  rulesCache: 'dli.rulesCache.v1',
} as const

export const PLUGIN_DATA_KEYS = {
  ignored: 'dli.ignored.v1',
} as const
