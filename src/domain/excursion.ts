import { formatSpan } from '../lib/format'
import type { Deviation } from './types'

export interface ExcursionSummary {
  /** Total minutes above the breach limit, across every excursion in this incident */
  minutes: number
  ongoing: boolean
  peakC: number
  count: number
}

const minutesBetween = (from: string, to: string) =>
  Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000))

/**
 * How long the tank stayed above the breach limit. Exposure time, together with the peak,
 * is what decides whether the stored units are still usable.
 */
export function excursionSummary(d: Deviation, now: string): ExcursionSummary | undefined {
  const list = d.excursions ?? []
  if (list.length === 0) return undefined
  const last = list[list.length - 1]
  return {
    minutes: list.reduce((sum, e) => sum + minutesBetween(e.startedAt, e.endedAt ?? now), 0),
    ongoing: !last.endedAt,
    peakC: Math.max(...list.map((e) => e.peakC)),
    count: list.length,
  }
}

export function describeExcursion(x: ExcursionSummary): string {
  const time = x.ongoing ? `${formatSpan(x.minutes)} and counting` : `${formatSpan(x.minutes)} in total`
  const times = x.count > 1 ? ` over ${x.count} excursions` : ''
  return `${time}${times}, peak ${x.peakC.toFixed(1)} °C`
}
