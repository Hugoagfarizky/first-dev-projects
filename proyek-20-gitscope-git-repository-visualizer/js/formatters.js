export function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return new Intl.NumberFormat('id-ID').format(value);
}

export function formatDate(value) {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function formatRateLimit(rateLimit) {
  if (!rateLimit) {
    return 'Rate limit: tidak tersedia';
  }

  const remaining = Number.isFinite(rateLimit.remaining) ? rateLimit.remaining : '—';
  const limit = Number.isFinite(rateLimit.limit) ? rateLimit.limit : '—';
  const reset = rateLimit.resetAt ? `reset ${rateLimit.resetAt}` : 'reset tidak tersedia';
  return `Rate limit: ${remaining}/${limit} (${reset})`;
}

export function truncateText(value, maxLength = 500) {
  const text = String(value ?? '');
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}…`;
}

/**
 * Only allow plain HTTPS links to github.com to be used as href values.
 * API responses are treated as untrusted text, including URL fields.
 */
export function sanitizeExternalUrl(value) {
  if (typeof value !== 'string' || value === '') {
    return null;
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' || url.hostname !== 'github.com') {
    return null;
  }

  if (url.username !== '' || url.password !== '') {
    return null;
  }

  return url.href;
}
