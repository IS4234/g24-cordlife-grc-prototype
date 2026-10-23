export type RoleId = 'operator' | 'cgo' | 'board' | 'moh'

export interface Role {
  id: RoleId
  label: string
  who: string
  view: 'Micro' | 'Meso' | 'Macro'
  summary: string
}

// No login: the prototype switches between roles to show each level of oversight
export const ROLES: Role[] = [
  {
    id: 'operator',
    label: 'Operator',
    who: 'Cord blood bank staff',
    view: 'Micro',
    summary: 'Monitor storage tanks, raise deviations and escalate issues.',
  },
  {
    id: 'cgo',
    label: 'Clinical Governance',
    who: 'Clinical Governance Officer / QA',
    view: 'Meso',
    summary: 'Investigate deviations, record root cause and CAPA, approve closures.',
  },
  {
    id: 'board',
    label: 'Board & C-suite',
    who: 'Board of Directors / senior management',
    view: 'Meso',
    summary: 'Review compliance KRIs, escalated deviations and risk-appetite settings.',
  },
  {
    id: 'moh',
    label: 'MOH',
    who: 'Ministry of Health (regulator)',
    view: 'Macro',
    summary: 'View overall compliance posture and critical non-compliance alerts.',
  },
]

export const DEFAULT_ROLE: RoleId = 'operator'

export function getRole(id: RoleId): Role {
  return ROLES.find((r) => r.id === id) ?? ROLES[0]
}
