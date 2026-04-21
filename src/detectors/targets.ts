import type { DetectorFn, Recommendation } from './types'
import { buildRecommendation } from '../shared/recommendation'
import { byIdMap, distanceBetween, isTappable, resolveNodePath } from './utils/geometry'

function platformMin(platform: string, params: Record<string, unknown>) {
  return Number(params[platform] ?? (platform === 'ios' ? 44 : platform === 'android' ? 48 : 24))
}

const PLATFORM_LABEL: Record<string, string> = { ios: 'iOS', android: 'Android', web: 'Web' }
const PLATFORM_STANDARD: Record<string, string> = {
  ios: 'Apple HIG — Layout',
  android: 'Material Design 3',
  web: 'WCAG 2.2 §2.5.8',
}

/** touch-target: минимальный размер интерактивного элемента. */
export const touchTarget: DetectorFn = ({ nodes, rule, settings }) => {
  const out: Recommendation[] = []
  const byId = byIdMap(nodes)
  const min = platformMin(settings.platform, rule.detector?.params ?? {})
  for (const n of nodes) {
    if (!isTappable(n)) continue
    if (n.width < min || n.height < min) {
      out.push(
        buildRecommendation({
          rule,
          detectorId: 'touch-target',
          origin: 'auto',
          target: { nodeId: n.id, nodeName: n.name, path: resolveNodePath(n.id, byId) },
          title: `Мелкий таргет для ${PLATFORM_LABEL[settings.platform] ?? settings.platform}`,
          summary: `Таргет ${Math.round(n.width)}×${Math.round(n.height)} меньше минимума ${min}×${min} px.`,
          standard: PLATFORM_STANDARD[settings.platform],
          fix: {
            steps: [
              `Увеличьте элемент до ${min}×${min} px.`,
              'Или добавьте прозрачную hit-area вокруг иконки.',
            ],
            expected: `${min}×${min} px`,
            actual: `${Math.round(n.width)}×${Math.round(n.height)} px`,
          },
          measurements: { width: Math.round(n.width), height: Math.round(n.height), min },
        }),
      )
    }
  }
  return out
}

/** button-min-size: кнопки ≥ 44×44. */
export const buttonMinSize: DetectorFn = ({ nodes, rule }) => {
  const out: Recommendation[] = []
  const byId = byIdMap(nodes)
  const minW = Number(rule.detector?.params?.minWidth ?? 44)
  const minH = Number(rule.detector?.params?.minHeight ?? 44)
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
            steps: [`Увеличьте кнопку до минимума ${minW}×${minH} px.`, 'Проверьте отступы — padding должен сохранять вертикальный ритм.'],
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

/** target-spacing: между мелкими таргетами ≥ 24 px. */
export const targetSpacing: DetectorFn = ({ nodes, rule }) => {
  const out: Recommendation[] = []
  const byId = byIdMap(nodes)
  const clearance = Number(rule.detector?.params?.minClearance ?? 24)
  const small = nodes.filter((n) => isTappable(n) && (n.width < 44 || n.height < 44))
  for (let i = 0; i < small.length; i++) {
    for (let j = i + 1; j < small.length; j++) {
      const a = small[i]
      const b = small[j]
      if (a.parentId !== b.parentId) continue
      const d = distanceBetween(a, b)
      if (d < clearance) {
        out.push(
          buildRecommendation({
            rule,
            detectorId: 'target-spacing',
            origin: 'auto',
            target: { nodeId: a.id, nodeName: a.name, path: resolveNodePath(a.id, byId) },
            title: 'Мелкие таргеты близко друг к другу',
            summary: `«${a.name}» и «${b.name}» стоят в ${Math.round(d)} px — легко ошибиться пальцем.`,
            fix: {
              steps: [`Добавьте минимум ${clearance} px между мелкими таргетами.`, 'Или укрупните оба элемента до ≥44 px.'],
              expected: `≥ ${clearance} px`,
              actual: `${Math.round(d)} px`,
            },
            measurements: { distance: Math.round(d), clearance },
          }),
        )
        break
      }
    }
  }
  return out
}
