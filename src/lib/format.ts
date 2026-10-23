const dateTime = new Intl.DateTimeFormat('en-SG', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Singapore',
})

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso))
}

function formatSpan(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  if (minutes < 48 * 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m ? `${h} h ${m} min` : `${h} h`
  }
  return `${Math.round(minutes / 1440)} days`
}

/** Time until a deadline, relative to the simulated clock */
export function formatDue(dueAt: string, now: string): { text: string; overdue: boolean } {
  const diff = Math.round((new Date(dueAt).getTime() - new Date(now).getTime()) / 60_000)
  if (diff <= 0) return { text: diff === 0 ? 'due now' : `overdue ${formatSpan(-diff)}`, overdue: true }
  return { text: `in ${formatSpan(diff)}`, overdue: false }
}
