import { useState } from 'react'
import { isActive } from '../domain/deviations'
import type { Deviation } from '../domain/types'
import type { RoleId } from '../roles'
import { useAppState } from '../store/store'
import { DeviationDetail } from './DeviationDetail'
import { DeviationTable } from './DeviationTable'
import { Drawer } from './Drawer'
import { NewDeviationForm } from './NewDeviationForm'
import './DeviationRegister.css'

type Filter = 'active' | 'closed' | 'all'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'closed', label: 'Closed' },
  { id: 'all', label: 'All' },
]

interface DeviationRegisterProps {
  role: RoleId
  actorId: string
  canRaise?: boolean
}

function sortDeviations(list: Deviation[]): Deviation[] {
  // Active ones by nearest deadline first; closed ones newest first
  return [...list].sort((a, b) => {
    const aActive = isActive(a)
    const bActive = isActive(b)
    if (aActive !== bActive) return aActive ? -1 : 1
    if (aActive) return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
    return new Date(b.raisedAt).getTime() - new Date(a.raisedAt).getTime()
  })
}

export function DeviationRegister({ role, actorId, canRaise }: DeviationRegisterProps) {
  const state = useAppState()
  const [filter, setFilter] = useState<Filter>('active')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const visible = sortDeviations(
    state.deviations.filter((d) => (filter === 'all' ? true : filter === 'active' ? isActive(d) : !isActive(d))),
  )
  const selected = state.deviations.find((d) => d.id === selectedId)

  return (
    <section className="register">
      <div className="register__head">
        <h2>Deviations</h2>
        <div className="register__tools">
          <div className="segmented" role="tablist" aria-label="Filter deviations">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                className={filter === f.id ? 'segmented__btn segmented__btn--active' : 'segmented__btn'}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          {canRaise && (
            <button type="button" className="btn btn--small" onClick={() => setCreating(true)}>
              Raise deviation
            </button>
          )}
        </div>
      </div>

      <DeviationTable deviations={visible} now={state.simTime} onSelect={setSelectedId} />

      {selected && (
        <Drawer title={<span className="mono">{selected.id}</span>} onClose={() => setSelectedId(null)}>
          <DeviationDetail deviation={selected} state={state} role={role} actorId={actorId} />
        </Drawer>
      )}

      {creating && (
        <Drawer title="Raise deviation" onClose={() => setCreating(false)}>
          <NewDeviationForm tanks={state.tanks} actorId={actorId} onDone={() => setCreating(false)} />
        </Drawer>
      )}
    </section>
  )
}
