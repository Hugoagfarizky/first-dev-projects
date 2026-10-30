export function normalizeCommitList(data) {
  if (!Array.isArray(data)) {
    return {
      ok: false,
      error: 'Respons daftar commit tidak valid.',
    };
  }

  const commits = [];
  const seen = new Set();

  for (const item of data) {
    const normalized = normalizeCommitSummary(item);
    if (!normalized || seen.has(normalized.sha)) {
      continue;
    }
    seen.add(normalized.sha);
    commits.push(normalized);
  }

  return {
    ok: true,
    commits,
  };
}

export function normalizeCommitDetail(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      ok: false,
      error: 'Respons detail commit tidak valid.',
    };
  }

  const summary = normalizeCommitSummary(data);
  if (!summary) {
    return {
      ok: false,
      error: 'Respons detail commit tidak valid.',
    };
  }

  const files = Array.isArray(data.files)
    ? data.files.map(normalizeChangedFile).filter(Boolean)
    : [];

  return {
    ok: true,
    commit: {
      ...summary,
      files,
      stats: normalizeStats(data.stats),
    },
  };
}

function normalizeCommitSummary(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return null;
  }

  const commit = item.commit && typeof item.commit === 'object' && !Array.isArray(item.commit)
    ? item.commit
    : {};
  const author = commit.author && typeof commit.author === 'object' ? commit.author : {};
  const committer = commit.committer && typeof commit.committer === 'object' ? commit.committer : {};

  const sha = typeof item.sha === 'string' && item.sha !== '' ? item.sha : null;
  if (!sha) {
    return null;
  }

  return {
    sha,
    shortSha: sha.slice(0, 7),
    message: typeof commit.message === 'string' ? commit.message : '',
    authorName: typeof author.name === 'string' ? author.name : (typeof item.author?.login === 'string' ? item.author.login : null),
    authorEmail: typeof author.email === 'string' ? author.email : null,
    authorDate: typeof author.date === 'string' ? author.date : null,
    authorLogin: typeof item.author?.login === 'string' ? item.author.login : null,
    committerName: typeof committer.name === 'string' ? committer.name : (typeof item.committer?.login === 'string' ? item.committer.login : null),
    committerDate: typeof committer.date === 'string' ? committer.date : null,
    parentShas: Array.isArray(item.parents)
      ? item.parents.map((parent) => (typeof parent?.sha === 'string' ? parent.sha : null)).filter(Boolean)
      : [],
    htmlUrl: typeof item.html_url === 'string' ? item.html_url : null,
  };
}

function normalizeChangedFile(file) {
  if (!file || typeof file !== 'object' || Array.isArray(file)) {
    return null;
  }
  return {
    filename: typeof file.filename === 'string' ? file.filename : '',
    status: typeof file.status === 'string' ? file.status : 'unknown',
    additions: Number.isFinite(file.additions) ? file.additions : 0,
    deletions: Number.isFinite(file.deletions) ? file.deletions : 0,
    changes: Number.isFinite(file.changes) ? file.changes : 0,
    patch: typeof file.patch === 'string' ? file.patch : null,
    previousFilename: typeof file.previous_filename === 'string' ? file.previous_filename : null,
    blobUrl: typeof file.blob_url === 'string' ? file.blob_url : null,
    rawUrl: typeof file.raw_url === 'string' ? file.raw_url : null,
  };
}

function normalizeStats(stats) {
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) {
    return null;
  }
  return {
    additions: Number.isFinite(stats.additions) ? stats.additions : 0,
    deletions: Number.isFinite(stats.deletions) ? stats.deletions : 0,
    total: Number.isFinite(stats.total) ? stats.total : 0,
  };
}
