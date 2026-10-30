export function normalizeComparison(data, refs = {}) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      ok: false,
      error: 'Respons comparison tidak valid.',
    };
  }

  const commitsResult = normalizeCommits(data.commits);
  const filesResult = normalizeFiles(data.files);

  return {
    ok: true,
    comparison: {
      base: typeof refs.base === 'string' ? refs.base : (typeof data.base === 'string' ? data.base : ''),
      head: typeof refs.head === 'string' ? refs.head : (typeof data.head === 'string' ? data.head : ''),
      status: typeof data.status === 'string' && data.status !== '' ? data.status : 'unknown',
      aheadBy: numberOrZero(data.ahead_by),
      behindBy: numberOrZero(data.behind_by),
      totalCommits: numberOrZero(data.total_commits),
      baseCommit: normalizeCommitSummary(data.base_commit),
      mergeBaseCommit: normalizeCommitSummary(data.merge_base_commit),
      commits: commitsResult.commits,
      files: filesResult.files,
      filesAvailable: filesResult.available,
      filesPossiblyTruncated: filesResult.possiblyTruncated,
      additions: numberOrZero(data.stats?.additions),
      deletions: numberOrZero(data.stats?.deletions),
      totalChanges: numberOrZero(data.stats?.total),
      htmlUrl: typeof data.html_url === 'string' ? data.html_url : null,
      diffUrl: typeof data.diff_url === 'string' ? data.diff_url : null,
      patchUrl: typeof data.patch_url === 'string' ? data.patch_url : null,
    },
  };
}

function normalizeCommits(data) {
  if (!Array.isArray(data)) {
    return { commits: [] };
  }

  const commits = [];
  const seen = new Set();

  for (const item of data) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const sha = typeof item.sha === 'string' && item.sha !== '' ? item.sha : null;
    if (!sha || seen.has(sha)) {
      continue;
    }
    seen.add(sha);

    const commit = item.commit && typeof item.commit === 'object' && !Array.isArray(item.commit)
      ? item.commit
      : {};
    const author = commit.author && typeof commit.author === 'object' ? commit.author : {};
    const committer = commit.committer && typeof commit.committer === 'object' ? commit.committer : {};

    commits.push({
      sha,
      shortSha: sha.slice(0, 7),
      message: typeof commit.message === 'string' ? commit.message : '',
      authorName: typeof author.name === 'string' ? author.name : (typeof item.author?.login === 'string' ? item.author.login : null),
      authorDate: typeof author.date === 'string' ? author.date : null,
      committerName: typeof committer.name === 'string' ? committer.name : (typeof item.committer?.login === 'string' ? item.committer.login : null),
      committerDate: typeof committer.date === 'string' ? committer.date : null,
      parentShas: Array.isArray(item.parents)
        ? item.parents.map((parent) => (typeof parent?.sha === 'string' ? parent.sha : null)).filter(Boolean)
        : [],
      htmlUrl: typeof item.html_url === 'string' ? item.html_url : null,
    });
  }

  return { commits };
}

function normalizeFiles(data) {
  if (!Array.isArray(data)) {
    return {
      files: [],
      available: false,
      possiblyTruncated: false,
    };
  }

  const files = data.map((file) => {
    if (!file || typeof file !== 'object' || Array.isArray(file)) {
      return null;
    }
    return {
      sha: typeof file.sha === 'string' ? file.sha : null,
      filename: typeof file.filename === 'string' ? file.filename : '',
      status: typeof file.status === 'string' ? file.status : 'unknown',
      additions: numberOrZero(file.additions),
      deletions: numberOrZero(file.deletions),
      changes: numberOrZero(file.changes),
      patch: typeof file.patch === 'string' ? file.patch : null,
      previousFilename: typeof file.previous_filename === 'string' ? file.previous_filename : null,
      blobUrl: typeof file.blob_url === 'string' ? file.blob_url : null,
      rawUrl: typeof file.raw_url === 'string' ? file.raw_url : null,
    };
  }).filter(Boolean);

  return {
    files,
    available: true,
    possiblyTruncated: files.length >= 300,
  };
}

function normalizeCommitSummary(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }
  const commit = data.commit && typeof data.commit === 'object' && !Array.isArray(data.commit)
    ? data.commit
    : {};
  const author = commit.author && typeof commit.author === 'object' ? commit.author : {};
  const committer = commit.committer && typeof commit.committer === 'object' ? commit.committer : {};

  if (typeof data.sha !== 'string' || data.sha === '') {
    return null;
  }

  return {
    sha: data.sha,
    shortSha: data.sha.slice(0, 7),
    message: typeof commit.message === 'string' ? commit.message : '',
    authorName: typeof author.name === 'string' ? author.name : (typeof data.author?.login === 'string' ? data.author.login : null),
    authorEmail: typeof author.email === 'string' ? author.email : null,
    authorDate: typeof author.date === 'string' ? author.date : null,
    authorLogin: typeof data.author?.login === 'string' ? data.author.login : null,
    committerName: typeof committer.name === 'string' ? committer.name : (typeof data.committer?.login === 'string' ? data.committer.login : null),
    committerDate: typeof committer.date === 'string' ? committer.date : null,
    parentShas: Array.isArray(data.parents)
      ? data.parents.map((parent) => (typeof parent?.sha === 'string' ? parent.sha : null)).filter(Boolean)
      : [],
    htmlUrl: typeof data.html_url === 'string' ? data.html_url : null,
  };
}

function numberOrZero(value) {
  return Number.isFinite(value) ? value : 0;
}
