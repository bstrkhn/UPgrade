export const MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

export interface Period {
  year: number;
  month: number;
}

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const WIB_TIME_ZONE = 'Asia/Jakarta';

export function monthNameId(month: number): string {
  return MONTH_NAMES_ID[month - 1] ?? '';
}

/** Current calendar year/month in WIB (+07:00), independent of the browser time zone. */
export function getCurrentWibPeriod(now: Date = new Date()): Period {
  const shifted = new Date(now.getTime() + WIB_OFFSET_MS);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1 };
}

export function formatPeriodId(period: Period): string {
  return `${monthNameId(period.month)} ${period.year}`;
}

/** Moves a period forward or backward by whole months. */
export function shiftPeriod(period: Period, deltaMonths: number): Period {
  const index = period.year * 12 + (period.month - 1) + deltaMonths;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function isSamePeriod(a: Period, b: Period): boolean {
  return a.year === b.year && a.month === b.month;
}

/** "21 November 2026" in WIB. */
export function formatDateId(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const shifted = new Date(date.getTime() + WIB_OFFSET_MS);
  return `${shifted.getUTCDate()} ${monthNameId(shifted.getUTCMonth() + 1)} ${shifted.getUTCFullYear()}`;
}

/** "21 November 2026, 14.05" in WIB. */
export function formatDateTimeId(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const time = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: WIB_TIME_ZONE,
  }).format(date);
  return `${formatDateId(date)}, ${time}`;
}

/** YYYY-MM-DD in WIB, suitable for <input type="date">. */
export function toDateInputValue(value: string | Date = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const shifted = new Date(date.getTime() + WIB_OFFSET_MS);
  const year = String(shifted.getUTCFullYear()).padStart(4, '0');
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converts a YYYY-MM-DD input value into an ISO timestamp for a new transaction.
 * Today keeps the current time of day; other days use noon WIB so the date never shifts.
 */
export function dateInputToTransactionDate(dateValue: string, now: Date = new Date()): string {
  if (dateValue === toDateInputValue(now)) {
    return now.toISOString();
  }
  return new Date(`${dateValue}T12:00:00.000+07:00`).toISOString();
}
