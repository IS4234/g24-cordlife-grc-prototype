import type { ReactNode } from 'react'
import type { Tone } from '../lib/labels'
import './Pill.css'

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`pill pill--${tone}`}>{children}</span>
}
