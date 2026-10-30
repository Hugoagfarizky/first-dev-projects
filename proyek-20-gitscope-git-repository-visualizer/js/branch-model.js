export function normalizeBranches(data) {
  if (!Array.isArray(data)) {
    return {
      ok: false,
      error: 'Respons daftar branch tidak valid.',
    };
  }

  const branches = [];
  const seen = new Set();

  for (const item of data) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const name = typeof item.name === 'string' ? item.name : '';
    if (name === '' || seen.has(name)) {
      continue;
    }
    seen.add(name);
    branches.push({
      name,
      commitSha: typeof item.commit?.sha === 'string' ? item.commit.sha : null,
      protected: Boolean(item.protected),
    });
  }

  return {
    ok: true,
    branches,
  };
}

export function findBranch(branches, name) {
  if (!Array.isArray(branches) || typeof name !== 'string') {
    return null;
  }
  return branches.find((branch) => branch.name === name) || null;
}

export function resolveSelectedBranch(branches, preferredName) {
  if (typeof preferredName === 'string' && preferredName !== '') {
    const found = findBranch(branches, preferredName);
    if (found) {
      return found.name;
    }
    return preferredName;
  }
  return branches.length > 0 ? branches[0].name : null;
}
