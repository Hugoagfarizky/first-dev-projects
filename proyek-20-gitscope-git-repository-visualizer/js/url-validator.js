export function validateRepositoryUrl(value) {
  if (typeof value !== 'string') {
    return {
      ok: false,
      error: 'URL repositori harus berupa teks.',
    };
  }

  const input = value.trim();
  if (input === '') {
    return {
      ok: false,
      error: 'URL repositori tidak boleh kosong.',
    };
  }

  let url;
  try {
    url = new URL(input);
  } catch {
    return {
      ok: false,
      error: 'Format URL repositori tidak valid.',
    };
  }

  if (url.protocol !== 'https:') {
    return {
      ok: false,
      error: 'URL repositori harus menggunakan HTTPS.',
    };
  }

  if (url.username !== '' || url.password !== '') {
    return {
      ok: false,
      error: 'URL repositori tidak boleh menyertakan kredensial.',
    };
  }

  if (url.hostname !== 'github.com') {
    return {
      ok: false,
      error: 'Host repositori harus github.com.',
    };
  }

  if (url.search !== '' || url.hash !== '') {
    return {
      ok: false,
      error: 'URL repositori tidak boleh memiliki query atau fragment.',
    };
  }

  const segments = url.pathname.split('/').filter((segment) => segment !== '');
  if (segments.length !== 2) {
    return {
      ok: false,
      error: 'URL repositori harus berbentuk https://github.com/owner/repo.',
    };
  }

  let owner = safeDecode(segments[0]);
  let repo = safeDecode(segments[1]);

  if (owner === null || repo === null) {
    return {
      ok: false,
      error: 'Segmen URL repositori tidak valid.',
    };
  }

  if (repo.toLowerCase().endsWith('.git')) {
    repo = repo.slice(0, -4);
  }

  if (!isValidSegment(owner) || !isValidSegment(repo)) {
    return {
      ok: false,
      error: 'Nama owner atau repository tidak valid.',
    };
  }

  return {
    ok: true,
    owner,
    repo,
    repository: `${owner}/${repo}`,
    url: `https://github.com/${owner}/${repo}`,
  };
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function isValidSegment(value) {
  if (value === '' || value === '.' || value === '..') {
    return false;
  }

  // Avoid control characters and whitespace. GitHub owner/repository names
  // may contain Unicode, so do not restrict the segment to ASCII.
  return !/[\u0000-\u001f\u007f-\u009f\s]/.test(value);
}
