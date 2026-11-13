import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isActive } from '../src/domain/deviations.ts'
import { addMinutes } from '../src/domain/rules.ts'
import { operatorAlertTitle } from '../src/lib/labels.ts'
import { injectUnmonitoredUnits, returnTankToService, verifyProbeMapping } from '../src/store/actions.ts'
import { getState, resetDemo } from '../src/store/store.ts'

test('a recovered monitoring gap changes the banner text while keeping the incident open', () => {
  resetDemo()
  injectUnmonitoredUnits('T-09')
  const incident = getState().deviations.find((d) => d.trigger === 'unmonitored_units')
  assert.ok(incident)
  assert.equal(operatorAlertTitle(incident, getState()), incident.title)

  verifyProbeMapping('T-09', 'p-aisyah')
  assert.equal(operatorAlertTitle(incident, getState()), incident.title)
  returnTankToService('T-09', 'p-aisyah')
  const state = getState()
  assert.equal(operatorAlertTitle(incident, state), 'T-09 monitoring restored — incident awaiting closure')
  const current = state.deviations.find((d) => d.id === incident.id)
  assert.equal(isActive(current), true)
  assert.equal(current.title, incident.title)

  for (const changes of [
    { serviceStatus: 'servicing' },
    { probeVerified: false },
    { lastReadingAt: addMinutes(state.simTime, -10) },
  ]) {
    const unavailable = { ...state, tanks: state.tanks.map((t) => t.id === 'T-09' ? { ...t, ...changes } : t) }
    assert.equal(operatorAlertTitle(incident, unavailable), incident.title)
  }
  const unrelated = { ...incident, trigger: 'breach', title: 'Temperature breach' }
  assert.equal(operatorAlertTitle(unrelated, state), unrelated.title)
})

test('verifying a probe updates both recovered alerts without dismissing either incident', () => {
  resetDemo()
  injectUnmonitoredUnits('T-09')
  returnTankToService('T-09', 'p-aisyah')
  const probeIncident = getState().deviations.find((d) => d.trigger === 'probe_unverified')
  assert.ok(probeIncident)
  assert.equal(operatorAlertTitle(probeIncident, getState()), probeIncident.title)

  verifyProbeMapping('T-09', 'p-aisyah')
  const state = getState()
  const incidents = state.deviations.filter((d) => d.tankId === 'T-09')
  assert.equal(incidents.length, 2)
  assert.ok(incidents.every((d) => isActive(d) && d.severity === 'critical'))
  assert.equal(operatorAlertTitle(probeIncident, state), 'T-09 probe mapping verified — incident awaiting closure')
  const gap = incidents.find((d) => d.trigger === 'unmonitored_units')
  assert.equal(operatorAlertTitle(gap, state), 'T-09 monitoring restored — incident awaiting closure')
  assert.equal(state.deviations.find((d) => d.id === probeIncident.id).title, probeIncident.title)

  const unverified = { ...state, tanks: state.tanks.map((t) => t.id === 'T-09' ? { ...t, probeVerified: false } : t) }
  assert.equal(operatorAlertTitle(probeIncident, unverified), probeIncident.title)
})
