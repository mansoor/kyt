// Metadata describing each alert type and its configurable parameters.
// Kept in sync with backend services/alerts.py ALERT_TYPES.

export type ParamField =
  | { key: string; kind: 'number'; label: string; suffix?: string; default?: number; optional?: boolean }
  | { key: string; kind: 'time'; label: string; default?: string }
  | { key: string; kind: 'weekdays'; label: string }
  | { key: string; kind: 'geofence'; label: string; optional?: boolean }

export interface AlertTypeMeta {
  type: string
  label: string
  description: string
  fields: ParamField[]
}

export const ALERT_TYPES: AlertTypeMeta[] = [
  { type: 'charge_complete', label: 'Charge complete', description: 'When charging finishes (optionally at a target level).',
    fields: [{ key: 'target_pct', kind: 'number', label: 'Target level', suffix: '%', optional: true }] },
  { type: 'low_battery', label: 'Low battery', description: 'When the battery drops to or below a threshold.',
    fields: [{ key: 'threshold_pct', kind: 'number', label: 'Threshold', suffix: '%', default: 20 }] },
  { type: 'charge_started', label: 'Charging started', description: 'Each time a charge session begins.', fields: [] },
  { type: 'charge_stopped', label: 'Charging stopped', description: 'Each time a charge session ends.', fields: [] },
  { type: 'drive_completed', label: 'Drive completed', description: 'A summary after each drive.', fields: [] },
  { type: 'drive_outside_window', label: 'Unexpected drive', description: 'When the car is driven outside your normal window.',
    fields: [
      { key: 'days', kind: 'weekdays', label: 'Allowed days' },
      { key: 'start', kind: 'time', label: 'From', default: '07:00' },
      { key: 'end', kind: 'time', label: 'To', default: '21:00' },
    ] },
  { type: 'speed_exceeded', label: 'Speed alert', description: 'When the car exceeds a speed limit.',
    fields: [{ key: 'limit_kmh', kind: 'number', label: 'Speed limit', suffix: 'km/h', default: 120 }] },
  { type: 'geofence_enter', label: 'Arrived at location', description: 'When the car enters a geofence.',
    fields: [{ key: 'geofence_id', kind: 'geofence', label: 'Location', optional: true }] },
  { type: 'geofence_exit', label: 'Left location', description: 'When the car leaves a geofence.',
    fields: [{ key: 'geofence_id', kind: 'geofence', label: 'Location', optional: true }] },
  { type: 'software_update', label: 'Software update', description: 'When a software update starts installing.', fields: [] },
]

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']  // index 0=Mon matches Python weekday()

export function metaFor(type: string): AlertTypeMeta | undefined {
  return ALERT_TYPES.find((t) => t.type === type)
}
