import type { DetectorFn, Recommendation } from './types'
import { buildRecommendation } from '../shared/recommendation'
import type { Severity } from '../shared/rules-types'
import { byIdMap, distanceBetween, isTappable, resolveNodePath } from './utils/geometry'

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' ? v : Number(v ?? fallback)
}

const PLATFORM_LABEL: Record<string, string> = { ios: 'iOS', android: 'Android', web: 'Web' }
const PLATFORM_STANDARD: Record<string, string> = {
  ios: 'Apple HIG — Layout',
  android: 'Material Design 3',
  web: 'WCAG 2.2 §2.5.8',
}

/** touch-target: минимальный размер интерактивного элемента. Градиент severity. */
export const touchTarget: DetectorFn = ({ nodes, rule, settings }) => {
  const out: Recommendation[] = []
  const byId = byIdMap(nodes)
  const p = rule.detector?.params ?? {}
  const hardMins: Record<string, number> = {
    ios: num(p.ios, 44),
    android: num(p.android, 48),
    web: num(p.web, 44),
  }
  const strictMins: Record<string, number> = {
    ios: num(p.strictIos, 48),
    android: num(p.strictAndroid, 56),
    web: num(p.strictWeb, 48),
  }
  const platform = settings.platform
  const hardMin = hardMins[platform] ?? 44
  const strictMin = strictMins[platform] ?? 48

  for (const n of nodes) {
    if (!isTappable(n)) continue
    const minDim = Math.min(n.width, n.height)
    let severity: Severity | null = null
    let expected = ''
    if (minDim < hardMin) {
      severity = 'error'
      expected = `${hardMin}×${hardMin} px`
    } else if (minDim < strictMin) {
      severity = 'warning'
      expected = `${strictMin}×${strictMin} px (рекомендуется)`
    }
    if (!severity) continue
    out.push(
      buildRecommendation({
        rule,
        detectorId: 'touch-target',
        origin: 'auto',
        severity,
        target: { nodeId: n.id, nodeName: n.name, path: resolveNodePath(n.id, byId) },
        title: `Мелкий таргет для ${PLATFORM_LABEL[platform] ?? platform}`,
        summary: `Таргет ${Math.round(n.width)}×${Math.round(n.height)} меньше ${severity === 'error' ? `минимума ${hardMin}×${hardMin}` : `рекомендуемых ${strictMin}×${strictMin}`} px.`,
        standard: PLATFORM_STANDARD[platform],
        fix: {
          steps: [
            `Увеличьте элемент до ${severity === 'error' ? hardMin : strictMin}×${severity === 'error' ? hardMin : strictMin} px.`,
            'Или добавьте прозрачную hit-area вокруг иконки.',
          ],
          expected,
          actual: `${Math.round(n.width)}×${Math.round(n.height)} px`,
        },
        measurements: { width: Math.round(n.width), height: Math.round(n.height), hardMin, strictMin },
      }),
    )
  }
  return out
}

/** button-min-size: ≥ 48×48 в strict-режиме. */
export const buttonMinSize: DetectorFn = ({ nodes, rule }) => {
  const out: Recommendation[] = []
  const byId = byIdMap(nodes)
  const minW = Number(rule.detector?.params?.minWidth ?? 48)
  const minH = Number(rule.detector?.params?.minHeight ?? 48)
  for (const n of nodes) {
    if (!/btn|button|cta/i.test(n.name)) continue
    if (n.width < minW || n.height < minH) {
      out.push(
        buildRecommendation({
          rule,
          detectorId: 'button-min-size',
          origin: 'auto',
          target: { nodeId: n.id, nodeName: n.name, path: resolveNodePath(n.id, byId) },
          title: 'Кнопка мельче рекомендуемой',
          summary: `Кнопка ${Math.round(n.width)}×${Math.round(n.height)} меньше ${minW}×${minH} px.`,
          fix: {
            steps: [`Увеличьте кнопку до минимума ${minW}×${minH} px.`, 'Padding должен сохранять вертикальный ритм.'],
            expected: `${minW}×${minH} px`,
            actual: `${Math.round(n.width)}×${Math.round(n.height)} px`,
          },
          measurements: { width: Math.round(n.width), height: Math.round(n.height) },
        }),
      )
    }
  }
  return out
}

/** target-spacing: минимальное расстояние между мелкими таргетами. */
export const targetSpacing: DetectorFn = ({ nodes, rule }) => {
  const out: Recommendation[] = []
  const byId = byIdMap(nodes)
  const clearance = Number(rule.detector?.params?.minClearance ?? 32)
  const strictClearance = Number(rule.detector?.params?.strictClearance ?? 40)
  const small = nodes.filter((n) => isTappable(n) && (n.width < 44 || n.height < 44))
  const seenPairs = new Set<string>()
  for (let i = 0; i < small.length; i++) {
    for (let j = i + 1; j < small.length; j++) {
      const a = small[i]
      const b = small[j]
      if (a.parentId !== b.parentId) continue
      const d = distanceBetween(a, b)
      let severity: Severity | null = null
      if (d < clearance) severity = 'warning'
      else if (d < strictClearance) severity = 'info'
      if (!severity) continue
      const key = `${a.id}|${b.id}`
      if (seenPairs.has(key)) continue
      seenPairs.add(key)
      out.push(
        buildRecommendation({
          rule,
          detectorId: 'target-spacing',
          origin: 'auto',
          severity,
          target: { nodeId: a.id, nodeName: a.name, path: resolveNodePath(a.id, byId) },
          title: severity === 'warning' ? 'Мелкие таргеты близко' : 'Таргеты тесно стоят',
          summary: `«${a.name}» и «${b.name}» в ${Math.round(d)} px друг от друга.`,
          fix: {
            steps: [
              `Добавьте минимум ${severity === 'warning' ? clearance : strictClearance} px.`,
              'Или укрупните оба элемента до ≥44 px.',
            ],
            expected: `≥ ${severity === 'warning' ? clearance : strictClearance} px`,
            actual: `${Math.round(d)} px`,
          },
          measurements: { distance: Math.round(d), clearance, strictClearance },
        }),
      )
      break
    }
  }
  return out
}
