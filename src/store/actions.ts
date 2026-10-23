import { withAudit } from '../domain/audit'
import { advanceMinutes } from '../domain/simulation'
import { setState } from './store'

export function advanceClock(minutes: number) {
  setState((s) => advanceMinutes(s, minutes))
}

/** Demo control: makes a tank start warming, as if LN2 supply failed. Not audited, since it is not a real event. */
export function injectWarmingFault(tankId: string) {
  setState((s) => ({
    ...s,
    tanks: s.tanks.map((t) => (t.id === tankId ? { ...t, fault: 'warming' } : t)),
  }))
}

export function restoreCooling(tankId: string, personId: string) {
  setState((s) =>
    withAudit(
      { ...s, tanks: s.tanks.map((t) => (t.id === tankId ? { ...t, fault: undefined } : t)) },
      {
        actorId: personId,
        action: 'tank.cooling_restored',
        entityId: tankId,
        detail: `${tankId} LN2 supply restored; temperature recovering. Any linked deviation stays open for investigation.`,
      },
    ),
  )
}
