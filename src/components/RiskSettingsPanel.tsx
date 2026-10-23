import { useState } from 'react'
import { personName } from '../domain/people'
import { settingsErrors } from '../domain/settings'
import type { AuditEntry, RiskSettings, Severity } from '../domain/types'
import { formatDateTime } from '../lib/format'
import { SEVERITY } from '../lib/labels'
import { saveRiskSettings } from '../store/actions'
import './RiskSettingsPanel.css'

interface RiskSettingsPanelProps {
  settings: RiskSettings
  actorId: string
  lastChange?: AuditEntry
}

const SEVERITIES: Severity[] = ['critical', 'major', 'minor']

// Remount with a key on settings so the draft never goes stale after a reset or another tab's change
export function RiskSettingsPanel({ settings, actorId, lastChange }: RiskSettingsPanelProps) {
  const [draft, setDraft] = useState<RiskSettings>(settings)
  const [reason, setReason] = useState('')
  const errors = settingsErrors(draft)
  const changed = JSON.stringify(draft) !== JSON.stringify(settings)

  const setDeadline = (s: Severity, value: number) =>
    setDraft({ ...draft, deadlineMinutes: { ...draft.deadlineMinutes, [s]: value } })

  return (
    <section className="risk">
      <div className="risk__head">
        <h2>Risk appetite</h2>
        <p>
          Set by the Board and applied automatically by the system. Changes take effect immediately and are recorded in
          the audit log with a reason.
        </p>
      </div>

      <form
        className="risk__form"
        onSubmit={(e) => {
          e.preventDefault()
          saveRiskSettings(draft, actorId, reason)
          setReason('')
        }}
      >
        <fieldset className="risk__group">
          <legend>Storage temperature</legend>
          <label className="field">
            Breach limit (°C)
            <input
              id="risk-threshold"
              type="number"
              step="1"
              value={draft.thresholdC}
              onChange={(e) => {
                setDraft({ ...draft, thresholdC: Number(e.target.value) })
              }}
            />
          </label>
          <label className="field">
            Warning level (°C)
            <input
              id="risk-warning"
              type="number"
              step="1"
              value={draft.warningC}
              onChange={(e) => {
                setDraft({ ...draft, warningC: Number(e.target.value) })
              }}
            />
          </label>
        </fieldset>

        <fieldset className="risk__group">
          <legend>Escalation deadline per level (simulated minutes)</legend>
          {SEVERITIES.map((s) => (
            <label key={s} className="field">
              {SEVERITY[s].label}
              <input
                id={`risk-deadline-${s}`}
                type="number"
                min={5}
                value={draft.deadlineMinutes[s]}
                onChange={(e) => {
                    setDeadline(s, Number(e.target.value))
                }}
              />
            </label>
          ))}
        </fieldset>

        <fieldset className="risk__group">
          <legend>Regulator notification</legend>
          <label className="field">
            Push to MOH when a deviation of this severity reaches the Board
            <select
              id="risk-moh-severity"
              value={draft.mohNotifySeverity}
              onChange={(e) => {
                setDraft({ ...draft, mohNotifySeverity: e.target.value as Severity })
              }}
            >
              <option value="critical">Critical only</option>
              <option value="major">Major and critical</option>
              <option value="minor">All deviations</option>
            </select>
          </label>
        </fieldset>

        <label className="field risk__reason">
          Reason for change
          <input
            id="risk-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. ARC meeting 12 Nov: shorten critical deadline after audit finding"
          />
        </label>

        {errors.length > 0 && (
          <ul className="form-errors">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        <div className="risk__actions">
          <button type="submit" className="btn btn--small" disabled={!changed || errors.length > 0 || reason.trim().length < 10}>
            Save risk appetite
          </button>
          {changed && (
            <button type="button" className="btn btn--ghost btn--small" onClick={() => setDraft(settings)}>
              Discard changes
            </button>
          )}
          {lastChange && !changed && (
            <span className="risk__saved">
              Last changed by {personName(lastChange.actorId)} at{' '}
              <span className="mono">{formatDateTime(lastChange.at)}</span>
            </span>
          )}
        </div>
      </form>
    </section>
  )
}
