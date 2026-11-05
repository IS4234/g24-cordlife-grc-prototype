import type { ReactNode } from 'react'
import type { Tone } from '../lib/labels'
import './Pill.css'

interface PillProps {
  tone: Tone
  /** Replaces the default status dot */
  icon?: ReactNode
  children: ReactNode
}

export function Pill({ tone, icon, children }: PillProps) {
  return (
    <span className={icon ? `pill pill--${tone} pill--icon` : `pill pill--${tone}`}>
      {icon}
      {children}
    </span>
  )
}
