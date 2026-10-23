import { useSyncExternalStore } from 'react'
import { createSeedState, STATE_VERSION } from '../domain/seed'
import type { AppState, AuditEntry } from '../domain/types'

// All reads and writes go through this module, so swapping browser storage
// for a hosted database later only changes this file.

const STORAGE_KEY = 'g24-cordlife-demo'

type Listener = () => void

const listeners = new Set<Listener>()
let state: AppState = load()

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      if (parsed.version === STATE_VERSION) return parsed
    }
  } catch {
    // Storage blocked or corrupt: fall back to seed data
  }
  return createSeedState()
}

function save(next: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Storage unavailable: the demo still works for this session
  }
}

function emit() {
  listeners.forEach((l) => l())
}

export function getState(): AppState {
  return state
}

export function setState(update: (s: AppState) => AppState) {
  state = update(state)
  save(state)
  emit()
}

export function resetDemo() {
  state = createSeedState()
  save(state)
  emit()
}

/** Appends an audit entry. The log is append-only: there is no update or delete. */
export function withAudit(s: AppState, entry: Omit<AuditEntry, 'id' | 'at'> & { at?: string }): AppState {
  const id = `AUD-${String(s.nextAuditSeq).padStart(4, '0')}`
  return {
    ...s,
    audit: [...s.audit, { ...entry, id, at: entry.at ?? s.simTime }],
    nextAuditSeq: s.nextAuditSeq + 1,
  }
}

function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Keep other tabs in sync, so an Operator tab and an MOH tab can run side by side
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return
    state = load()
    emit()
  })
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState)
}
