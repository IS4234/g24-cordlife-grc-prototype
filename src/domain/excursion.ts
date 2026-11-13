import { formatSpan } from '../lib/format'
import type { Deviation } from './types'

export interface ExcursionSummary {
  /** Confirmed minutes above the breach limit, excluding gaps without trusted readings */
  minutes: number
  ongoing: boolean
  unknownMinutes: number
  unknownOngoing: boolean
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
  const unknownMinutes = list.reduce((sum, e) => sum + (e.unknownPeriods ?? []).reduce(
    (total, gap) => total + minutesBetween(gap.startedAt, gap.endedAt ?? e.endedAt ?? now), 0,
  ), 0)
  const gap = last.unknownPeriods?.at(-1)
  const unknownOngoing = !last.endedAt && gap !== undefined && !gap.endedAt
  return {
    minutes: Math.max(0, list.reduce((sum, e) => sum + minutesBetween(e.startedAt, e.endedAt ?? now), 0) - unknownMinutes),
    ongoing: !last.endedAt && !unknownOngoing,
    unknownMinutes,
    unknownOngoing,
    peakC: Math.max(...list.map((e) => e.peakC)),
    count: list.length,
  }
}

/** Shared wording for compact cards and full incident reports. */
export function describeExposureTime(x: ExcursionSummary): string {
  const hasUnknown = x.unknownMinutes > 0 || x.unknownOngoing
  const time = hasUnknown
    ? `${formatSpan(x.minutes)} confirmed${x.ongoing ? ' and counting' : ''}`
    : x.ongoing ? `${formatSpan(x.minutes)} and counting` : `${formatSpan(x.minutes)} in total`
  const unknown = hasUnknown ? `; ${formatSpan(x.unknownMinutes)} unknown${x.unknownOngoing ? ' and counting' : ''}` : ''
  return `${time}${unknown}`
}

export function describeExcursion(x: ExcursionSummary): string {
  const times = x.count > 1 ? ` over ${x.count} excursions` : ''
  return `${describeExposureTime(x)}${times}, observed peak ${x.peakC.toFixed(1)} °C`
}
