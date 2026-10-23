import type { Person } from './types'

// Fictional demo personas. Quality assurance reports to the Board's Audit and Risk Committee,
// so a QA approver is independent of the Clinical Governance line.
export const PEOPLE: Person[] = [
  { id: 'p-aisyah', name: 'Aisyah Rahman', title: 'Laboratory Technician', role: 'operator', line: 'operations' },
  { id: 'p-marcus', name: 'Marcus Lee', title: 'Laboratory Supervisor', role: 'operator', line: 'operations' },
  { id: 'p-rachel', name: 'Dr Rachel Ng', title: 'Clinical Governance Officer', role: 'cgo', line: 'clinical_governance' },
  { id: 'p-daniel', name: 'Daniel Koh', title: 'Quality Assurance Manager', role: 'cgo', line: 'quality_assurance' },
  { id: 'p-helen', name: 'Helen Tay', title: 'Chair, Audit and Risk Committee', role: 'board', line: 'board' },
  { id: 'p-moh', name: 'MOH Licensing Inspector', title: 'Ministry of Health', role: 'moh', line: 'regulator' },
]

export const SYSTEM_ACTOR = 'system'

export function getPerson(id: string): Person | undefined {
  return PEOPLE.find((p) => p.id === id)
}

export function personName(id: string): string {
  if (id === SYSTEM_ACTOR) return 'System'
  return getPerson(id)?.name ?? id
}
