const TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(?:(Z)|([+-])(\d{2}):?(\d{2}))?$/i;
const MAX_TIMEZONE_OFFSET_MINUTES = 14 * 60;

function invalidTimestamp(error) {
  return {
    ok: false,
    timestampMs: null,
    timestampIso: null,
    timestampSource: 'none',
    error,
  };
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year, month) {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

function hasMatchingLocalParts(date, parts) {
  return date.getFullYear() === parts.year
    && date.getMonth() === parts.month - 1
    && date.getDate() === parts.day
    && date.getHours() === parts.hour
    && date.getMinutes() === parts.minute
    && date.getSeconds() === parts.second
    && date.getMilliseconds() === parts.millisecond;
}

function hasMatchingUtcParts(date, parts) {
  return date.getUTCFullYear() === parts.year
    && date.getUTCMonth() === parts.month - 1
    && date.getUTCDate() === parts.day
    && date.getUTCHours() === parts.hour
    && date.getUTCMinutes() === parts.minute
    && date.getUTCSeconds() === parts.second
    && date.getUTCMilliseconds() === parts.millisecond;
}

function buildLocalDate(parts) {
  const date = new Date(0);
  date.setFullYear(parts.year, parts.month - 1, parts.day);
  date.setHours(parts.hour, parts.minute, parts.second, parts.millisecond);
  return date;
}

function buildUtcDate(parts) {
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(parts.hour, parts.minute, parts.second, parts.millisecond);
  return date;
}

/**
 * Parse one complete timestamp string.
 *
 * Supported forms:
 * - 2026-10-27T10:20:30Z
 * - 2026-10-27T10:20:30+07:00
 * - 2026-10-27T10:20:30.123+0700
 * - 2026-10-27 10:20:30.123
 *
 * A timestamp without a timezone is interpreted in the browser's local
 * timezone. `timestampIso` is always the UTC ISO representation of the epoch.
 */
export function parseTimestamp(value) {
  try {
    if (typeof value !== 'string') {
      return invalidTimestamp('Timestamp harus berupa string.');
    }

    const input = value.trim();
    if (input === '') {
      return invalidTimestamp('Timestamp kosong.');
    }

    const match = TIMESTAMP_PATTERN.exec(input);
    if (!match) {
      return invalidTimestamp('Format timestamp tidak dikenali.');
    }

    const parts = {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      hour: Number(match[4]),
      minute: Number(match[5]),
      second: Number(match[6]),
      millisecond: match[7] ? Number((match[7] + '000').slice(0, 3)) : 0,
    };

    if (parts.month < 1 || parts.month > 12) {
      return invalidTimestamp('Bulan timestamp tidak valid.');
    }
    if (parts.day < 1 || parts.day > daysInMonth(parts.year, parts.month)) {
      return invalidTimestamp('Tanggal timestamp tidak valid.');
    }
    if (parts.hour < 0 || parts.hour > 23) {
      return invalidTimestamp('Jam timestamp tidak valid.');
    }
    if (parts.minute < 0 || parts.minute > 59) {
      return invalidTimestamp('Menit timestamp tidak valid.');
    }
    if (parts.second < 0 || parts.second > 59) {
      return invalidTimestamp('Detik timestamp tidak valid.');
    }

    const hasZone = Boolean(match[8] || match[9]);
    let timestampMs;

    if (hasZone) {
      let offsetMinutes = 0;

      if (match[9]) {
        const offsetHour = Number(match[10]);
        const offsetMinute = Number(match[11]);

        if (offsetMinute > 59
          || (offsetHour * 60) + offsetMinute > MAX_TIMEZONE_OFFSET_MINUTES) {
          return invalidTimestamp('Offset timezone tidak valid.');
        }

        offsetMinutes = (offsetHour * 60) + offsetMinute;
        if (match[9] === '-') {
          offsetMinutes *= -1;
        }
      }

      const utcDate = buildUtcDate(parts);
      if (!hasMatchingUtcParts(utcDate, parts)) {
        return invalidTimestamp('Tanggal atau waktu timestamp tidak valid.');
      }

      timestampMs = utcDate.getTime() - (offsetMinutes * 60 * 1000);
    } else {
      const localDate = buildLocalDate(parts);
      if (!hasMatchingLocalParts(localDate, parts)) {
        return invalidTimestamp('Tanggal atau waktu lokal tidak valid.');
      }

      timestampMs = localDate.getTime();
    }

    if (!Number.isFinite(timestampMs)) {
      return invalidTimestamp('Timestamp tidak valid.');
    }

    const isoDate = new Date(timestampMs);
    if (Number.isNaN(isoDate.getTime())) {
      return invalidTimestamp('Timestamp tidak valid.');
    }

    return {
      ok: true,
      timestampMs,
      timestampIso: isoDate.toISOString(),
      timestampSource: hasZone ? 'iso' : 'local',
      error: null,
    };
  } catch {
    return invalidTimestamp('Timestamp tidak dapat diproses.');
  }
}
