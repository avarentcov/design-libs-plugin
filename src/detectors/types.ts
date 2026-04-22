import type { FigmaRule } from '../shared/rules-types'
import type { Recommendation } from '../shared/recommendation'
import type { SerializedNode } from '../shared/serialize'

export type Platform = 'ios' | 'android' | 'web'

export interface DetectorSettings {
  platform: Platform
  darkTheme: boolean
}

export const DEFAULT_SETTINGS: DetectorSettings = {
  platform: 'web',
  darkTheme: false,
}

export interface DetectorContext {
  nodes: SerializedNode[]
  rule: FigmaRule
  settings: DetectorSettings
}

export type DetectorFn = (ctx: DetectorContext) => Recommendation[]

/** Реэкспорт для детекторов, чтобы не тянуть путь напрямую. */
export type { Recommendation } from '../shared/recommendation'
