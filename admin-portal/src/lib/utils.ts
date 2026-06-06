import { format } from 'date-fns'

export function initials(name: string | null | undefined): string {
  return (name ?? '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export function fmtDate(iso: string, fmt = 'MMM d, yyyy'): string {
  return format(new Date(iso), fmt)
}
