import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  approvalBlocker, approveChange, approveClosure, isIndependent, rejectChange,
  rejectClosure, requestChange, submitForClosure,
} from '../src/domain/closure.ts'
import { createDeviation } from '../src/domain/deviations.ts'
import { getPerson, PEOPLE } from '../src/domain/people.ts'
import { createSeedState } from '../src/domain/seed.ts'
import { updateSettings } from '../src/domain/settings.ts'
import { ROLES } from '../src/roles.ts'

const reviewer = 'p-priya'
const investigation = {
  rootCause: 'Equipment fault identified during inspection.',
  capa: 'Repaired the equipment and verified correct operation.',
  newEvidence: ['Inspection report.pdf'],
}

function pending(severity = 'major') {
  let state = createDeviation(createSeedState(), {
    title: 'Equipment inspection finding', description: 'Equipment fault requires investigation.',
    source: 'manual', category: 'equipment', severity, raisedBy: 'p-rachel', evidence: [],
  })
  const id = state.deviations.at(-1).id
  state = submitForClosure(state, id, 'p-daniel', investigation)
  return { state, id }
}

test('Priya shares the Clinical Governance selector and remains an independent QA director', () => {
  assert.deepEqual(ROLES.map((role) => role.id), ['operator', 'cgo', 'board', 'moh'])
  assert.deepEqual(PEOPLE.filter((person) => person.role === 'cgo').map((person) => person.id), ['p-rachel', 'p-daniel', reviewer])
  assert.equal(getPerson(reviewer).title, 'Clinical Quality Assurance Director')
  assert.equal(getPerson(reviewer).role, 'cgo')
  assert.equal(isIndependent(getPerson(reviewer)), true)
})

for (const severity of ['major', 'critical']) {
  test(`Rachel raises and Daniel submits a ${severity} deviation that Priya and Helen can close`, () => {
    let { state, id } = pending(severity)
    const deviation = state.deviations.find((d) => d.id === id)
    assert.match(approvalBlocker(deviation, 'p-rachel'), /raised/)
    assert.match(approvalBlocker(deviation, 'p-daniel'), /submitted/)
    assert.strictEqual(approveClosure(state, id, 'p-rachel'), state)
    assert.strictEqual(approveClosure(state, id, 'p-daniel'), state)
    state = approveClosure(state, id, reviewer)
    assert.equal(state.deviations.find((d) => d.id === id).status, 'pending_closure')
    assert.strictEqual(approveClosure(state, id, reviewer), state)
    state = approveClosure(state, id, 'p-helen')
    const closed = state.deviations.find((d) => d.id === id)
    assert.equal(closed.status, 'closed')
    assert.deepEqual(closed.approvals.map((approval) => approval.personId), [reviewer, 'p-helen'])
  })
}

test('Priya can close a minor deviation with one approval', () => {
  const { state, id } = pending('minor')
  assert.equal(approveClosure(state, id, reviewer).deviations.find((d) => d.id === id).status, 'closed')
})

test('Priya can raise and submit investigations but cannot approve her own work', () => {
  let state = createDeviation(createSeedState(), {
    title: 'Equipment fault', description: 'Equipment fault requires investigation.',
    source: 'manual', category: 'equipment', severity: 'major', raisedBy: reviewer, evidence: [],
  })
  const id = state.deviations.at(-1).id
  state = submitForClosure(state, id, reviewer, investigation)
  assert.equal(state.deviations.find((d) => d.id === id).submittedBy, reviewer)
  assert.strictEqual(approveClosure(state, id, reviewer), state)
  assert.strictEqual(updateSettings(state, { ...state.settings, warningC: -175 }, reviewer, 'Review current risk appetite.'), state)
  for (const actor of ['p-aisyah', 'p-moh']) {
    assert.strictEqual(approveClosure(state, id, actor), state)
    assert.strictEqual(rejectClosure(state, id, actor, 'Further investigation is required.'), state)
  }
  state = approveClosure(state, id, 'p-daniel')
  state = approveClosure(state, id, 'p-helen')
  assert.equal(state.deviations.find((d) => d.id === id).status, 'closed')

  const other = pending()
  const returned = rejectClosure(other.state, other.id, 'p-daniel', 'Further investigation is required.')
  const submitted = submitForClosure(returned, other.id, reviewer, investigation)
  assert.match(approvalBlocker(submitted.deviations.find((d) => d.id === other.id), reviewer), /submitted/)
})

test('Priya can send an investigation back and invalidate existing approvals', () => {
  let { state, id } = pending()
  state = approveClosure(state, id, 'p-helen')
  state = rejectClosure(state, id, reviewer, 'Further supporting evidence is needed.')
  const deviation = state.deviations.find((d) => d.id === id)
  assert.equal(deviation.status, 'investigating')
  assert.deepEqual(deviation.approvals, [])
})

test('Priya can request or independently review critical downgrade and dismissal requests', () => {
  for (const kind of ['downgrade', 'dismiss']) {
    const { state, id } = pending('critical')
    const open = rejectClosure(state, id, 'p-daniel', 'Further assessment is required.')
    const own = requestChange(open, id, reviewer, kind, 'Inspection found no affected units.', 'major')
    assert.equal(own.deviations.find((d) => d.id === id).pendingChange.requestedBy, reviewer)
    assert.strictEqual(approveChange(own, id, reviewer), own)
    const requested = requestChange(open, id, 'p-rachel', kind, 'Inspection found no affected units.', 'major')
    const approved = approveChange(requested, id, reviewer).deviations.find((d) => d.id === id)
    assert.equal(approved.pendingChange, undefined)
    assert.equal(kind === 'downgrade' ? approved.severity : approved.status, kind === 'downgrade' ? 'major' : 'closed')
    const rejected = rejectChange(requested, id, reviewer).deviations.find((d) => d.id === id)
    assert.equal(rejected.pendingChange, undefined)
    assert.equal(rejected.severity, 'critical')
  }
})
