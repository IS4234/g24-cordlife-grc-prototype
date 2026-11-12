import { atLeast } from '../domain/rules'
import type { RiskSettings, Severity } from '../domain/types'
import { formatSpan } from '../lib/format'
import { SEVERITY } from '../lib/labels'
import { Pill } from './Pill'
import './Severity.css'

const LEVELS: Severity[] = ['critical', 'major', 'minor']

/** Each level has its own shape, so severity never depends on colour alone */
export function SeverityIcon({ severity }: { severity: Severity }) {
  return (
    <svg className="sev-icon" viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
      {severity === 'critical' && <polygon points="5,0.6 9.7,9.4 0.3,9.4" fill="currentColor" />}
      {severity === 'major' && <polygon points="5,0.3 9.7,5 5,9.7 0.3,5" fill="currentColor" />}
      {severity === 'minor' && <circle cx="5" cy="5" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.8" />}
    </svg>
  )
}

export function SeverityPill({ severity }: { severity: Severity }) {
  const { label, tone } = SEVERITY[severity]
  return (
    <Pill tone={tone} icon={<SeverityIcon severity={severity} />}>
      {label}
    </Pill>
  )
}

/** Explains what each level means and how fast it escalates, read live from risk settings */
export function SeverityLegend({ settings }: { settings: RiskSettings }) {
  return (
    <section className="sev-legend" aria-label="Severity levels">
      {LEVELS.map((s) => (
        <div key={s} className="sev-legend__item">
          <SeverityPill severity={s} />
          <p className="sev-legend__meaning">{SEVERITY[s].meaning}</p>
          <p className="sev-legend__rule">
            Escalates one level every <strong>{formatSpan(settings.deadlineMinutes[s])}</strong> while open
            {s === 'critical' ? (
              <>; reported to MOH immediately when created or upgraded to critical</>
            ) : atLeast(s, settings.mohNotifySeverity) ? (
              <>; reported to MOH once it reaches the Board</>
            ) : null}
          </p>
        </div>
      ))}
    </section>
  )
}
