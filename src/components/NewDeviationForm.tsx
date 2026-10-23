import { useState } from 'react'
import { atLeast, severityForManual } from '../domain/rules'
import type { DeviationCategory, Severity, Tank } from '../domain/types'
import { CATEGORY_LABEL, SEVERITY } from '../lib/labels'
import { raiseDeviation } from '../store/actions'
import { Pill } from './Pill'

interface NewDeviationFormProps {
  tanks: Tank[]
  actorId: string
  onDone: () => void
}

const CATEGORIES = Object.keys(CATEGORY_LABEL) as DeviationCategory[]
const SEVERITIES: Severity[] = ['minor', 'major', 'critical']

export function NewDeviationForm({ tanks, actorId, onDone }: NewDeviationFormProps) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<DeviationCategory>('collection_bag')
  const [tankId, setTankId] = useState('')
  const [units, setUnits] = useState(0)
  const [description, setDescription] = useState('')
  const [evidence, setEvidence] = useState('')
  const [chosen, setChosen] = useState<Severity | ''>('')

  // The rule sets the floor; the raiser can only go higher
  const minimum = severityForManual(category, units)
  const allowed = SEVERITIES.filter((s) => atLeast(s, minimum))
  const severity = chosen && atLeast(chosen, minimum) ? chosen : minimum

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        raiseDeviation({
          title: title.trim(),
          description: description.trim(),
          source: 'manual',
          category,
          tankId: tankId || undefined,
          unitsAffected: units,
          severity,
          raisedBy: actorId,
          evidence: evidence.trim() ? [evidence.trim()] : [],
        })
        onDone()
      }}
    >
      <label className="field">
        Title
        <input
          id="new-dev-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Units stored without reaching cryopreservation temperature"
          required
        />
      </label>

      <div className="field-row">
        <label className="field">
          Category
          <select id="new-dev-category" value={category} onChange={(e) => setCategory(e.target.value as DeviationCategory)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Tank (optional)
          <select id="new-dev-tank" value={tankId} onChange={(e) => setTankId(e.target.value)}>
            <option value="">None</option>
            {tanks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Units possibly affected
          <input
            id="new-dev-units"
            type="number"
            min={0}
            value={units}
            onChange={(e) => setUnits(Math.max(0, Number(e.target.value) || 0))}
          />
        </label>
      </div>

      <label className="field">
        What happened
        <textarea
          id="new-dev-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
      </label>

      <label className="field">
        Evidence reference (optional)
        <input
          id="new-dev-evidence"
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          placeholder="e.g. Freezer log FRZ-02 batch B-1052.pdf"
        />
      </label>

      <div className="rule-box">
        <span>Minimum severity by rule:</span>
        <Pill tone={SEVERITY[minimum].tone}>{SEVERITY[minimum].label}</Pill>
      </div>

      <label className="field">
        Severity
        <span className="field__hint">You can raise the severity, but not set it below the rule.</span>
        <select id="new-dev-severity" value={severity} onChange={(e) => setChosen(e.target.value as Severity)}>
          {allowed.map((s) => (
            <option key={s} value={s}>
              {SEVERITY[s].label}
            </option>
          ))}
        </select>
      </label>

      <div>
        <button type="submit" className="btn">
          Raise deviation
        </button>
      </div>
    </form>
  )
}
