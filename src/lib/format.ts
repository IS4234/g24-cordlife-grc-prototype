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
