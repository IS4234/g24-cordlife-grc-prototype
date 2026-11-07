import { formatDateTime } from '../lib/format'
import { SEVERITY } from '../lib/labels'
import { withAudit } from './audit'
import { isActive, updateDeviation } from './deviations'
import { notifyMohIfDue } from './escalation'
import { getPerson, SYSTEM_ACTOR } from './people'
import { BREACH_LIMIT_C, dueAtFor } from './rules'
import type { AppState, RiskSettings, Severity } from './types'

export const SETTINGS_ENTITY = 'RISK-APPETITE'

const SEVERITIES: Severity[] = ['critical', 'major', 'minor']

export function settingsErrors(next: RiskSettings): string[] {
  const errors: string[] = []
  if (!Number.isFinite(next.warningC) || next.warningC >= BREACH_LIMIT_C) {
    errors.push(`The warning level must be colder than the ${BREACH_LIMIT_C} °C breach limit.`)
  }
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
  const saved = withAudit(
    { ...s, settings: next },
    {
      actorId,
      action: 'settings.changed',
      entityId: SETTINGS_ENTITY,
      detail: `Risk appetite changed: ${changes.join('; ')}. Reason: ${reason.trim()}`,
    },
  )
  return applyToOpenDeviations(saved, s.settings)
}

/**
 * Settings changes reach open deviations straight away, but only ever in the stricter direction:
 * - a shorter deadline brings an open deviation's deadline forward to now + the new deadline,
 *   while a longer one leaves it alone, so deadlines can't be stretched to avoid an escalation;
 * - a wider MOH reporting rule notifies open Board cases that now qualify.
 */
function applyToOpenDeviations(s: AppState, prev: RiskSettings): AppState {
  let next = s
  for (const d of s.deviations.filter(isActive)) {
    const sev = d.severity
    if (s.settings.deadlineMinutes[sev] < prev.deadlineMinutes[sev]) {
      const newDue = dueAtFor(sev, s.simTime, s.settings)
      if (newDue < d.dueAt) {
        next = updateDeviation(next, d.id, (cur) => ({ ...cur, dueAt: newDue }))
        next = withAudit(next, {
          actorId: SYSTEM_ACTOR,
          action: 'deviation.deadline_changed',
          entityId: d.id,
          detail: `Deadline brought forward to ${formatDateTime(newDue)} after the Board shortened the ${sev} deadline from ${prev.deadlineMinutes[sev]} to ${s.settings.deadlineMinutes[sev]} minutes.`,
        })
      }
    }
    if (s.settings.mohNotifySeverity !== prev.mohNotifySeverity) {
      next = notifyMohIfDue(next, d.id, 'Board widened MOH reporting to include this case')
    }
  }
  return next
}
