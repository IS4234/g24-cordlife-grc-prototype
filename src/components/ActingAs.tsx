import { isIndependent } from '../domain/closure'
import { PEOPLE } from '../domain/people'
import type { RoleId } from '../roles'
import './ActingAs.css'

interface ActingAsProps {
  role: RoleId
  personId: string
  onChange: (personId: string) => void
}

export function ActingAs({ role, personId, onChange }: ActingAsProps) {
  const people = PEOPLE.filter((p) => p.role === role)

  return (
    <div className="acting">
      <span className="acting__label">Acting as</span>
      <div className="acting__options" role="radiogroup" aria-label="Acting as">
        {people.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={p.id === personId}
            className={p.id === personId ? 'acting__person acting__person--active' : 'acting__person'}
            onClick={() => onChange(p.id)}
          >
            <span className="acting__name">{p.name}</span>
            <span className="acting__title">
              {p.title}
              {isIndependent(p) && ' · independent'}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
