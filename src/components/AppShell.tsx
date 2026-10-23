import type { ReactNode } from 'react'
import { ROLES, getRole, type RoleId } from '../roles'
import './AppShell.css'

interface AppShellProps {
  role: RoleId
  onRoleChange: (role: RoleId) => void
  children: ReactNode
}

export function AppShell({ role, onRoleChange, children }: AppShellProps) {
  const current = getRole(role)

  return (
    <div className="shell">
      <header className="shell__header">
        <div className="shell__bar">
          <div className="brand">
            <span className="brand__mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="brand__word">cordlife</span>
            <span className="brand__product">Compliance Monitor</span>
          </div>
          <span className="shell__notice">Prototype · IS4234 Group 24</span>
        </div>

        <nav className="roles" aria-label="Switch role">
          <span className="roles__label">Viewing as</span>
          <div className="roles__list" role="tablist">
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={r.id === role}
                className={r.id === role ? 'roles__tab roles__tab--active' : 'roles__tab'}
                onClick={() => onRoleChange(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <section className="hero">
        <div className="hero__inner">
          <span className="hero__eyebrow">
            {current.view} view · {current.who}
          </span>
          <h1 className="hero__title">{current.label} dashboard</h1>
          <p className="hero__summary">{current.summary}</p>
        </div>
      </section>

      <main className="shell__main">{children}</main>

      <footer className="shell__footer">
        Academic prototype for a case study. Not affiliated with or endorsed by Cordlife Group Limited. All data is
        simulated.
      </footer>
    </div>
  )
}
