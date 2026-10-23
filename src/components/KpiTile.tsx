import type { ReactNode } from 'react'
import './KpiTile.css'

interface KpiTileProps {
  label: string
  value: string
  tone: 'ok' | 'warn' | 'crit'
  sub?: string
  /** Regulation the indicator evidences */
  reg?: string
}

export function KpiTile({ label, value, tone, sub, reg }: KpiTileProps) {
  return (
    <div className={`kpi kpi--${tone}`}>
      <span className="kpi__label">{label}</span>
      <span className="kpi__value mono">{value}</span>
      {(sub || reg) && (
        <span className="kpi__foot">
          {sub && <span>{sub}</span>}
          {reg && <span className="kpi__reg">{reg}</span>}
        </span>
      )}
    </div>
  )
}

export function KpiRow({ children }: { children: ReactNode }) {
  return <div className="kpis">{children}</div>
}
