export interface WidgetCity {
  name: string;
  tz: string;
}

/** Cities offered in the widget builder, west to east. */
export const widgetCities: WidgetCity[] = [
  { name: 'Honolulu', tz: 'Pacific/Honolulu' },
  { name: 'Anchorage', tz: 'America/Anchorage' },
  { name: 'Los Angeles', tz: 'America/Los_Angeles' },
  { name: 'Vancouver', tz: 'America/Vancouver' },
  { name: 'Phoenix', tz: 'America/Phoenix' },
  { name: 'Denver', tz: 'America/Denver' },
  { name: 'Mexico City', tz: 'America/Mexico_City' },
  { name: 'Chicago', tz: 'America/Chicago' },
  { name: 'New York', tz: 'America/New_York' },
  { name: 'Toronto', tz: 'America/Toronto' },
  { name: 'Bogotá', tz: 'America/Bogota' },
  { name: 'São Paulo', tz: 'America/Sao_Paulo' },
  { name: 'Buenos Aires', tz: 'America/Argentina/Buenos_Aires' },
  { name: 'UTC', tz: 'Etc/UTC' },
  { name: 'London', tz: 'Europe/London' },
  { name: 'Lisbon', tz: 'Europe/Lisbon' },
  { name: 'Lagos', tz: 'Africa/Lagos' },
  { name: 'Paris', tz: 'Europe/Paris' },
  { name: 'Berlin', tz: 'Europe/Berlin' },
  { name: 'Amsterdam', tz: 'Europe/Amsterdam' },
  { name: 'Johannesburg', tz: 'Africa/Johannesburg' },
  { name: 'Cairo', tz: 'Africa/Cairo' },
  { name: 'Istanbul', tz: 'Europe/Istanbul' },
  { name: 'Moscow', tz: 'Europe/Moscow' },
  { name: 'Nairobi', tz: 'Africa/Nairobi' },
  { name: 'Riyadh', tz: 'Asia/Riyadh' },
  { name: 'Dubai', tz: 'Asia/Dubai' },
  { name: 'Karachi', tz: 'Asia/Karachi' },
  { name: 'New Delhi', tz: 'Asia/Kolkata' },
  { name: 'Kathmandu', tz: 'Asia/Kathmandu' },
  { name: 'Dhaka', tz: 'Asia/Dhaka' },
  { name: 'Bangkok', tz: 'Asia/Bangkok' },
  { name: 'Jakarta', tz: 'Asia/Jakarta' },
  { name: 'Singapore', tz: 'Asia/Singapore' },
  { name: 'Hong Kong', tz: 'Asia/Hong_Kong' },
  { name: 'Shanghai', tz: 'Asia/Shanghai' },
  { name: 'Manila', tz: 'Asia/Manila' },
  { name: 'Seoul', tz: 'Asia/Seoul' },
  { name: 'Tokyo', tz: 'Asia/Tokyo' },
  { name: 'Brisbane', tz: 'Australia/Brisbane' },
  { name: 'Sydney', tz: 'Australia/Sydney' },
  { name: 'Melbourne', tz: 'Australia/Melbourne' },
  { name: 'Auckland', tz: 'Pacific/Auckland' },
];

export const cityByTz = new Map(widgetCities.map((c) => [c.tz, c]));

/** "America/New_York" becomes "New York". */
export function cityLabel(tz: string): string {
  return cityByTz.get(tz)?.name ?? tz.split('/').pop()!.replace(/_/g, ' ');
}
