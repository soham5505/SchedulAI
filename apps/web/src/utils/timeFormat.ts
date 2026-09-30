/**
 * Converts a 24-hour time string (e.g. "13:30", "09:15", "14:15")
 * into 12-hour format (e.g. "1:30", "9:15", "2:15").
 *
 * @param time24 - Time string in "HH:mm" format.
 * @param withAmPm - Whether to append AM/PM (default: false).
 */
export function formatTo12Hour(time24: string, withAmPm = false): string {
  if (!time24 || typeof time24 !== 'string') return '';
  const parts = time24.trim().split(':');
  if (parts.length < 2) return time24;

  const rawHour = parseInt(parts[0], 10);
  const minute = parts[1];
  if (isNaN(rawHour)) return time24;

  const isPm = rawHour >= 12;
  let hour12 = rawHour % 12;
  if (hour12 === 0) hour12 = 12;

  const formatted = `${hour12}:${minute}`;
  if (withAmPm) {
    return `${formatted} ${isPm ? 'PM' : 'AM'}`;
  }
  return formatted;
}

/**
 * Formats a time range in 12-hour format.
 * Example: ("12:30", "13:30") => "12:30–1:30"
 */
export function formatTimeRange12Hour(startTime: string, endTime: string, withAmPm = false): string {
  if (!startTime && !endTime) return '';
  if (!endTime) return formatTo12Hour(startTime, withAmPm);
  if (!startTime) return formatTo12Hour(endTime, withAmPm);

  if (withAmPm) {
    return `${formatTo12Hour(startTime, true)} – ${formatTo12Hour(endTime, true)}`;
  }
  return `${formatTo12Hour(startTime)}–${formatTo12Hour(endTime)}`;
}
