import type { AppState, Tank } from './types'

export const STATE_VERSION = 1

// Demo starts on a Monday morning, Singapore time
const START = '2026-10-26T09:00:00+08:00'

function daysFrom(base: string, days: number): string {
  return new Date(new Date(base).getTime() + days * 86_400_000).toISOString()
}

function minutesFrom(base: string, minutes: number): string {
  return new Date(new Date(base).getTime() + minutes * 60_000).toISOString()
}

function tank(
  n: number,
  cbuCount: number,
  tempC: number,
  serviceStatus: Tank['serviceStatus'],
  lastServicedDaysAgo: number,
): Tank {
  return {
    id: `T-${String(n).padStart(2, '0')}`,
    location: n <= 6 ? 'Cryo Room A' : 'Cryo Room B',
    capacity: 6000,
    cbuCount,
    tempC,
    serviceStatus,
    lastServicedAt: daysFrom(START, -lastServicedDaysAgo),
    // Tanks are serviced every 90 days
    nextServiceDue: daysFrom(START, 90 - lastServicedDaysAgo),
    probeVerified: serviceStatus !== 'servicing',
  }
}

export function createSeedState(): AppState {
  const tanks: Tank[] = [
    tank(1, 5420, -191.2, 'in_service', 40),
    tank(2, 5810, -189.8, 'in_service', 12),
    tank(3, 4975, -190.5, 'in_service', 63),
    tank(4, 5230, -188.9, 'due_service', 86),
    tank(5, 5660, -192.0, 'in_service', 25),
    tank(6, 3120, -190.1, 'in_service', 51),
    tank(7, 5890, -187.6, 'in_service', 70),
    tank(8, 4410, -189.3, 'due_service', 88),
    tank(9, 0, -186.0, 'servicing', 0),
    tank(10, 2780, -191.6, 'in_service', 33),
    tank(11, 0, 21.0, 'not_in_use', 140),
    tank(12, 1950, -190.8, 'in_service', 18),
  ]

  return {
    version: STATE_VERSION,
    simTime: START,
    tanks,
    settings: {
      thresholdC: -150,
      warningC: -170,
      deadlineMinutes: { critical: 30, major: 240, minor: 1440 },
      mohNotifySeverity: 'critical',
    },
    deviations: [
      {
        id: 'DEV-2026-001',
        title: 'Collection bag lot exposed to temperature excursion',
        description:
          'Courier reported that collection bag lot CB-2291 was held above the supplier storage range for about 6 hours. Lot quarantined pending supplier assessment.',
        source: 'manual',
        category: 'collection_bag',
        severity: 'major',
        status: 'investigating',
        escalationLevel: 'cgo',
        raisedBy: 'p-marcus',
        raisedAt: minutesFrom(START, -26 * 60),
        dueAt: minutesFrom(START, 180),
        ownerId: 'p-daniel',
        evidence: ['Courier temperature log CB-2291.pdf'],
        approvals: [],
      },
      {
        id: 'DEV-2026-002',
        title: 'Controlled-rate freezer run did not complete profile',
        description:
          'Freezer FRZ-02 stopped 4 minutes before end of profile for unit batch B-1047. Units held in quarantine.',
        source: 'manual',
        category: 'freezing',
        severity: 'minor',
        status: 'open',
        escalationLevel: 'operator',
        raisedBy: 'p-aisyah',
        raisedAt: minutesFrom(START, -3 * 60),
        dueAt: minutesFrom(START, 21 * 60),
        evidence: [],
        approvals: [],
      },
      {
        id: 'DEV-2026-003',
        title: 'T-05 probe reading drift during weekly check',
        description: 'Reference thermometer differed from T-05 probe by 2.1 °C. Probe recalibrated and verified.',
        source: 'manual',
        category: 'equipment',
        tankId: 'T-05',
        severity: 'minor',
        status: 'closed',
        escalationLevel: 'operator',
        raisedBy: 'p-aisyah',
        raisedAt: daysFrom(START, -9),
        dueAt: daysFrom(START, -8),
        ownerId: 'p-daniel',
        rootCause: 'Probe calibration drift within expected annual range.',
        capa: 'Recalibrated probe; added monthly reference check for all tanks.',
        evidence: ['Calibration certificate T-05.pdf', 'Reference reading photo.jpg'],
        approvals: [
          { personId: 'p-daniel', at: daysFrom(START, -7) },
          { personId: 'p-marcus', at: daysFrom(START, -7) },
        ],
        closedAt: daysFrom(START, -7),
      },
    ],
    audit: [
      {
        id: 'AUD-0001',
        at: daysFrom(START, -9),
        actorId: 'p-aisyah',
        action: 'deviation.created',
        entityId: 'DEV-2026-003',
        detail: 'Raised minor deviation: T-05 probe reading drift during weekly check',
      },
      {
        id: 'AUD-0002',
        at: daysFrom(START, -7),
        actorId: 'p-daniel',
        action: 'deviation.closed',
        entityId: 'DEV-2026-003',
        detail: 'Closed with root cause, CAPA and 2 approvals',
      },
      {
        id: 'AUD-0003',
        at: minutesFrom(START, -26 * 60),
        actorId: 'p-marcus',
        action: 'deviation.created',
        entityId: 'DEV-2026-001',
        detail: 'Raised major deviation: Collection bag lot exposed to temperature excursion',
      },
      {
        id: 'AUD-0004',
        at: minutesFrom(START, -25 * 60),
        actorId: 'p-rachel',
        action: 'deviation.assigned',
        entityId: 'DEV-2026-001',
        detail: 'Assigned to Daniel Koh for investigation',
      },
      {
        id: 'AUD-0005',
        at: minutesFrom(START, -3 * 60),
        actorId: 'p-aisyah',
        action: 'deviation.created',
        entityId: 'DEV-2026-002',
        detail: 'Raised minor deviation: Controlled-rate freezer run did not complete profile',
      },
      {
        id: 'AUD-0006',
        at: daysFrom(START, 0),
        actorId: 'p-marcus',
        action: 'tank.service_started',
        entityId: 'T-09',
        detail: 'T-09 taken out of service for scheduled maintenance; probe verification required before return',
      },
    ],
    nextDeviationSeq: 4,
    nextAuditSeq: 7,
  }
}
