import { useState } from 'react'
import { DeviationDetail } from '../components/DeviationDetail'
import { DeviationTable } from '../components/DeviationTable'
import { Drawer } from '../components/Drawer'
import { KpiRow, KpiTile } from '../components/KpiTile'
import { Pill } from '../components/Pill'
import { SeverityPill } from '../components/Severity'
import { isActive, sortForRegister } from '../domain/deviations'
import { describeExcursion, excursionSummary } from '../domain/excursion'
import { computeKris } from '../domain/kri'
import { DEFAULT_PERSON, personName } from '../domain/people'
import { computePosture, type Rating } from '../domain/posture'
import { atLeast, BREACH_LIMIT_C, isInService, PROBE_STALE_MIN, readingAgeMin } from '../domain/rules'
import type { DeviationCategory, Severity } from '../domain/types'
import { formatDateTime } from '../lib/format'
import { CATEGORY_LABEL, DEVIATION_STATUS, LEVEL_LABEL, type Tone } from '../lib/labels'
import { acknowledgeMohAlert } from '../store/actions'
import { useAppState } from '../store/store'
import './MohView.css'

const ACTOR = DEFAULT_PERSON.moh

type AlertFilter = 'unacknowledged' | 'acknowledged' | 'all'

// Unacknowledged first: those are the alerts waiting on MOH, like unread mail
const ALERT_FILTERS: { id: AlertFilter; label: string; empty: string }[] = [
  { id: 'unacknowledged', label: 'Unacknowledged', empty: 'No alerts waiting for acknowledgement.' },
  { id: 'acknowledged', label: 'Acknowledged', empty: 'No alerts have been acknowledged yet.' },
  { id: 'all', label: 'All', empty: 'No alerts have been pushed to MOH.' },
]

const REPORTED: Record<Severity, string> = { critical: 'a critical', major: 'a major or critical', minor: 'any' }

// MOH chooses what it looks at; the licensee cannot hide anything from this register
const SEVERITY_FILTERS: { min: Severity; label: string }[] = [
  { min: 'critical', label: 'Critical' },
  { min: 'major', label: 'Major and above' },
  { min: 'minor', label: 'All' },
]

const RATING: Record<Rating, { label: string; tone: Tone }> = {
  good: { label: 'Good', tone: 'ok' },
  attention: { label: 'Needs attention', tone: 'warn' },
  at_risk: { label: 'At risk', tone: 'crit' },
}

export function MohView() {
  const state = useAppState()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [minSeverity, setMinSeverity] = useState<Severity>('major')
  const [alertFilter, setAlertFilter] = useState<AlertFilter>('unacknowledged')
  const posture = computePosture(state)
  const k = computeKris(state)
  const rating = RATING[posture.rating]

  const pushed = state.deviations.filter((d) => d.mohNotifiedAt)
  const alertCounts: Record<AlertFilter, number> = {
    unacknowledged: pushed.filter((d) => !d.mohAcknowledgedAt).length,
    acknowledged: pushed.filter((d) => d.mohAcknowledgedAt).length,
    all: pushed.length,
  }
  // Acknowledged means MOH has seen it, not that it is fixed, so open deviations still sort first
  const alerts = pushed
    .filter((d) =>
      alertFilter === 'all' ? true : alertFilter === 'acknowledged' ? d.mohAcknowledgedAt : !d.mohAcknowledgedAt,
    )
    .sort((a, b) => {
      if (isActive(a) !== isActive(b)) return isActive(a) ? -1 : 1
      return new Date(b.mohNotifiedAt!).getTime() - new Date(a.mohNotifiedAt!).getTime()
    })
  const selected = state.deviations.find((d) => d.id === selectedId)
  const register = sortForRegister(state.deviations.filter((d) => atLeast(d.severity, minSeverity)))

  const thirtyDaysAgo = new Date(state.simTime).getTime() - 30 * 86_400_000
  const byCategory = new Map<DeviationCategory, number>()
  state.deviations
    .filter((d) => new Date(d.raisedAt).getTime() >= thirtyDaysAgo)
    .forEach((d) => byCategory.set(d.category, (byCategory.get(d.category) ?? 0) + 1))
  const approvedChanges = k.changeRequests.reduce((n, r) => n + r.approved, 0)
  // Figures are only as current as the oldest live tank reading
  const liveTanks = state.tanks.filter(isInService)
  const oldestReading = liveTanks.map((t) => t.lastReadingAt).sort()[0] ?? state.simTime
  const silent = liveTanks.filter((t) => readingAgeMin(t, state.simTime) >= PROBE_STALE_MIN).length

  return (
    <div className="moh">
      <div className="licensee">
        <div>
          <span className="licensee__label">Licensee</span>
          <strong>Cordlife Group Limited</strong>
        </div>
        <div>
          <span className="licensee__label">Licence</span>
          <span>Cord Blood Banking Service (simulated)</span>
        </div>
        <div>
          <span className="licensee__label">Data feed</span>
          <span>Continuous · alerts and full deviation register, read-only</span>
        </div>
        <div>
          <span className="licensee__label">Data as of</span>
          <span>
            <span className="mono">{formatDateTime(oldestReading)}</span>
            {silent > 0 && (
              <span className="licensee__stale">
                {' · '}
                {silent} {silent === 1 ? 'tank' : 'tanks'} not reporting
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="moh__grid">
        <section className="posture">
          <h2>Compliance posture</h2>
          <ScoreRing score={posture.score} tone={rating.tone} />
          <Pill tone={rating.tone}>{rating.label}</Pill>
          {posture.cap && <p className="posture__cap">{posture.cap}</p>}
          <p className="posture__bands">85 and above: Good · 70 to 84: Needs attention · below 70: At risk</p>
        </section>

        <section className="breakdown">
          <h2>How the score is calculated</h2>
          <ul className="breakdown__list">
            {posture.components.map((c) => (
              <li key={c.id}>
                <div className="breakdown__row">
                  <span className="breakdown__label">{c.label}</span>
                  <span className="breakdown__weight mono">× {Math.round(c.weight * 100)}%</span>
                  <span className="breakdown__score mono">{c.score}</span>
                </div>
                <span className="breakdown__track">
                  <span
                    className={`breakdown__fill breakdown__fill--${c.score >= 85 ? 'ok' : c.score >= 70 ? 'warn' : 'crit'}`}
                    style={{ width: `${c.score}%` }}
                  />
                </span>
                <span className="breakdown__basis">{c.basis}</span>
              </li>
            ))}
          </ul>
          <p className="breakdown__formula mono">
            score = 0.3 × storage + 0.3 × timeliness + 0.2 × escalation + 0.2 × integrity
          </p>
        </section>
      </div>

      <section className="moh__section">
        <div className="moh__head">
          <div className="moh__title">
            <h2>Alerts</h2>
            <span>
              Pushed automatically when {REPORTED[state.settings.mohNotifySeverity]} deviation reaches the Board, or
              escalated to MOH directly
            </span>
          </div>
          <div className="segmented" role="tablist" aria-label="Filter alerts">
            {ALERT_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={alertFilter === f.id}
                className={alertFilter === f.id ? 'segmented__btn segmented__btn--active' : 'segmented__btn'}
                onClick={() => setAlertFilter(f.id)}
              >
                {f.label}
                <span className={f.id === 'unacknowledged' && alertCounts[f.id] > 0 ? 'moh__count moh__count--due' : 'moh__count'}>
                  {alertCounts[f.id]}
                </span>
              </button>
            ))}
          </div>
        </div>
        {alerts.length === 0 ? (
          <p className="moh__empty">{ALERT_FILTERS.find((f) => f.id === alertFilter)!.empty}</p>
        ) : (
          <ul className="alert-feed">
            {alerts.map((d) => {
              const active = isActive(d)
              const excursion = excursionSummary(d, state.simTime)
              return (
                <li key={d.id} className={active ? 'alert-card alert-card--active' : 'alert-card'}>
                  <div className="alert-card__top">
                    <span className="mono alert-card__id">{d.id}</span>
                    <SeverityPill severity={d.severity} />
                    {d.dismissed ? (
                      <Pill tone="neutral">Dismissed</Pill>
                    ) : (
                      <Pill tone={DEVIATION_STATUS[d.status].tone}>{DEVIATION_STATUS[d.status].label}</Pill>
                    )}
                  </div>
                  <strong className="alert-card__title">{d.title}</strong>
                  <dl className="alert-card__facts">
                    <div>
                      <dt>Notified</dt>
                      <dd className="mono">{formatDateTime(d.mohNotifiedAt!)}</dd>
                    </div>
                    <div>
                      <dt>Now with</dt>
                      <dd>{LEVEL_LABEL[d.escalationLevel]}</dd>
                    </div>
                    <div>
                      <dt>Owner</dt>
                      <dd>{d.ownerId ? personName(d.ownerId) : 'Unassigned'}</dd>
                    </div>
                    <div>
                      <dt>Acknowledged</dt>
                      <dd className="mono">{d.mohAcknowledgedAt ? formatDateTime(d.mohAcknowledgedAt) : 'Not yet'}</dd>
                    </div>
                    {excursion && (
                      <div className="alert-card__wide">
                        <dt>Time above {BREACH_LIMIT_C} °C</dt>
                        <dd className={excursion.ongoing ? 'alert-card__live' : undefined}>{describeExcursion(excursion)}</dd>
                      </div>
                    )}
                  </dl>
                  <div className="alert-card__actions">
                    {!d.mohAcknowledgedAt && (
                      <button type="button" className="btn btn--small" onClick={() => acknowledgeMohAlert(d.id, ACTOR)}>
                        Acknowledge
                      </button>
                    )}
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => setSelectedId(d.id)}>
                      View audit trail
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="moh__section">
        <div className="moh__head">
          <div className="moh__title">
            <h2>Deviation register</h2>
            <span>Every deviation the licensee has raised, read-only. MOH sets this filter, not the licensee.</span>
          </div>
          <div className="segmented" role="tablist" aria-label="Minimum severity">
            {SEVERITY_FILTERS.map((f) => (
              <button
                key={f.min}
                type="button"
                role="tab"
                aria-selected={minSeverity === f.min}
                className={minSeverity === f.min ? 'segmented__btn segmented__btn--active' : 'segmented__btn'}
                onClick={() => setMinSeverity(f.min)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <DeviationTable deviations={register} now={state.simTime} onSelect={setSelectedId} />
      </section>

      <section className="moh__section">
        <div className="moh__head">
          <h2>Licensee summary</h2>
          <span>Aggregates across all of the licensee's tanks and deviations</span>
        </div>
        <KpiRow>
          <KpiTile
            label="Tanks within limit"
            value={`${k.tanksInLimitPct}%`}
            sub={k.tanksUnknown ? `${k.tanksUnknown} unverified or no data` : undefined}
            tone={k.tanksInLimitPct < 100 ? 'crit' : 'ok'}
          />
          <KpiTile
            label="Open deviations"
            value={String(k.openDeviations)}
            sub={`${k.openCritical} critical`}
            tone={k.openCritical ? 'crit' : k.openDeviations ? 'warn' : 'ok'}
          />
          <KpiTile
            label="Missed escalation deadlines"
            value={String(k.missedDeadlines)}
            sub={`${k.overdueNow} overdue now${k.overdueMohResponses ? ` · ${k.overdueMohResponses} MOH response overdue` : ''}`}
            tone={k.missedDeadlines || k.overdueNow ? 'crit' : 'ok'}
          />
          <KpiTile
            label="Approved downgrades or dismissals"
            value={String(approvedChanges)}
            tone={approvedChanges ? 'warn' : 'ok'}
          />
        </KpiRow>
        <div className="categories">
          <h3>Deviations raised in the last 30 days, by category</h3>
          <ul>
            {(Object.keys(CATEGORY_LABEL) as DeviationCategory[]).map((c) => (
              <li key={c}>
                <span>{CATEGORY_LABEL[c]}</span>
                <span className="mono">{byCategory.get(c) ?? 0}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {selected && (
        <Drawer title={<span className="mono">{selected.id}</span>} onClose={() => setSelectedId(null)}>
          <DeviationDetail deviation={selected} state={state} role="moh" actorId={ACTOR} />
        </Drawer>
      )}
    </div>
  )
}

function ScoreRing({ score, tone }: { score: number; tone: Tone }) {
  const r = 52
  const c = 2 * Math.PI * r
  return (
    <svg className={`ring ring--${tone}`} viewBox="0 0 128 128" role="img" aria-label={`Score ${score} out of 100`}>
      <circle className="ring__track" cx="64" cy="64" r={r} />
      <circle
        className="ring__value"
        cx="64"
        cy="64"
        r={r}
        strokeDasharray={`${(score / 100) * c} ${c}`}
        transform="rotate(-90 64 64)"
      />
      <text className="ring__text" x="64" y="70" textAnchor="middle">
        {score}
      </text>
    </svg>
  )
}
