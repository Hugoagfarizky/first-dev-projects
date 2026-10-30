export function normalizeRepository(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      ok: false,
      error: 'Respons metadata repositori tidak valid.',
    };
  }

  return {
    ok: true,
    repository: {
      id: typeof data.id === 'number' ? data.id : null,
      fullName: data.full_name || data.name || '',
      name: data.name || '',
      owner: data.owner?.login || data.owner?.name || '',
      ownerUrl: data.owner?.html_url || null,
      description: typeof data.description === 'string' ? data.description : null,
      defaultBranch: data.default_branch || null,
      language: data.language || null,
      stars: numberOrZero(data.stargazers_count),
      forks: numberOrZero(data.forks_count),
      openIssues: numberOrZero(data.open_issues_count),
      updatedAt: data.updated_at || null,
      htmlUrl: data.html_url || null,
    },
  };
}

function numberOrZero(value) {
  return Number.isFinite(value) ? value : 0;
}
