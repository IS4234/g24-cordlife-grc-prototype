import { SEVERITY } from '../lib/labels'
import { withAudit } from './audit'
import { getPerson } from './people'
import type { AppState, RiskSettings, Severity } from './types'

export const SETTINGS_ENTITY = 'RISK-APPETITE'

const SEVERITIES: Severity[] = ['critical', 'major', 'minor']

export function settingsErrors(next: RiskSettings): string[] {
  const errors: string[] = []
  if (next.warningC >= next.thresholdC) errors.push('The warning level must be colder than the breach limit.')
  if (next.thresholdC > -135) errors.push('The breach limit cannot be warmer than −135 °C (glass transition range).')
  for (const s of SEVERITIES) {
    if (!Number.isFinite(next.deadlineMinutes[s]) || next.deadlineMinutes[s] < 5) {
      errors.push(`The ${SEVERITY[s].label.toLowerCase()} deadline must be at least 5 minutes.`)
    }
  }
  if (next.deadlineMinutes.critical > next.deadlineMinutes.major || next.deadlineMinutes.major > next.deadlineMinutes.minor) {
    errors.push('More severe deviations must have shorter or equal deadlines.')
  }
  return errors
}

function describeChanges(prev: RiskSettings, next: RiskSettings): string[] {
  const changes: string[] = []
  if (prev.thresholdC !== next.thresholdC) changes.push(`breach limit ${prev.thresholdC} → ${next.thresholdC} °C`)
  if (prev.warningC !== next.warningC) changes.push(`warning level ${prev.warningC} → ${next.warningC} °C`)
  for (const s of SEVERITIES) {
    if (prev.deadlineMinutes[s] !== next.deadlineMinutes[s]) {
      changes.push(`${s} deadline ${prev.deadlineMinutes[s]} → ${next.deadlineMinutes[s]} min`)
    }
  }
  if (prev.mohNotifySeverity !== next.mohNotifySeverity) {
    changes.push(`MOH notified from ${prev.mohNotifySeverity} → ${next.mohNotifySeverity}`)
  }
  return changes
}

/** Only the Board sets risk appetite. Every change is recorded with a reason. */
export function updateSettings(s: AppState, next: RiskSettings, actorId: string, reason: string): AppState {
  if (getPerson(actorId)?.role !== 'board' || settingsErrors(next).length || reason.trim().length < 10) return s
  const changes = describeChanges(s.settings, next)
  if (changes.length === 0) return s
  return withAudit(
    { ...s, settings: next },
    {
      actorId,
      action: 'settings.changed',
      entityId: SETTINGS_ENTITY,
      detail: `Risk appetite changed: ${changes.join('; ')}. Reason: ${reason.trim()}`,
    },
  )
}
