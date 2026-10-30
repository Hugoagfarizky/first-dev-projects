import { createGitScopeController } from './app-controller.js';
import { validateRepositoryUrl } from './url-validator.js';
import { createGitHubApiClient } from './github-api-client.js';
import { normalizeRepository } from './repo-model.js';
import { buildCommitGraph } from './commit-graph.js';
import { renderCommitGraph } from './commit-graph-renderer.js';
import {
  announceStatus,
  clearContainer,
  createTextElement,
  setHidden,
  setText,
} from './ui.js';
import { formatNumber, formatDate, formatRateLimit, sanitizeExternalUrl } from './formatters.js';
import { parsePatch } from './patch-viewer.js';

const elements = {};

function collectElements() {
  elements.appStatus = document.getElementById('app-status');
  elements.form = document.getElementById('repository-form');
  elements.urlInput = document.getElementById('repository-url');
  elements.checkButton = document.getElementById('check-button');
  elements.cancelButton = document.getElementById('cancel-button');
  elements.resetButton = document.getElementById('reset-button');
  elements.validationMessage = document.getElementById('validation-message');
  elements.repositorySummary = document.getElementById('repository-summary');
  elements.rateLimit = document.getElementById('rate-limit');
  elements.branchPanel = document.getElementById('branch-panel');
  elements.branchSelect = document.getElementById('branch-select');
  elements.loadMoreBranches = document.getElementById('load-more-branches');
  elements.branchStatus = document.getElementById('branch-status');
  elements.commitStatus = document.getElementById('commit-status');
  elements.commitList = document.getElementById('commit-list');
  elements.loadMoreCommits = document.getElementById('load-more-commits');
  elements.commitGraph = document.getElementById('commit-graph');
  elements.graphStatus = document.getElementById('graph-status');
  elements.graphSummary = document.getElementById('graph-summary');
  elements.comparisonBase = document.getElementById('comparison-base');
  elements.comparisonHead = document.getElementById('comparison-head');
  elements.compareButton = document.getElementById('compare-button');
  elements.loadMoreComparison = document.getElementById('load-more-comparison');
  elements.comparisonStatus = document.getElementById('comparison-status');
  elements.comparisonSummary = document.getElementById('comparison-summary');
  elements.comparisonCommitList = document.getElementById('comparison-commit-list');
  elements.comparisonFileList = document.getElementById('comparison-file-list');
  elements.comparisonDiff = document.getElementById('comparison-diff');
  elements.commitDetail = document.getElementById('commit-detail');
}

let controller = null;

const SCROLL_TARGETS = [
  { selector: '#commit-list' },
  { selector: '#commit-graph' },
  { selector: '#comparison-commit-list' },
  { selector: '#comparison-diff .patch', getKey: () => elements.comparisonDiff?.dataset.scrollKey },
];

function scrollKeyFor(target) {
  return target.getKey ? target.getKey() : null;
}

function captureScrollPositions() {
  const positions = [];
  for (const target of SCROLL_TARGETS) {
    const element = document.querySelector(target.selector);
    if (!element) {
      continue;
    }
    positions.push({
      selector: target.selector,
      top: element.scrollTop,
      left: element.scrollLeft,
      key: scrollKeyFor(target),
    });
  }
  return positions;
}

function restoreScrollPositions(positions) {
  for (const position of positions) {
    const target = SCROLL_TARGETS.find((item) => item.selector === position.selector);
    if (target?.getKey && scrollKeyFor(target) !== position.key) {
      continue;
    }
    const element = document.querySelector(position.selector);
    if (!element) {
      continue;
    }
    if (element.scrollTop !== position.top) {
      element.scrollTop = position.top;
    }
    if (element.scrollLeft !== position.left) {
      element.scrollLeft = position.left;
    }
  }
}

function captureFocusKey() {
  const active = document.activeElement;
  return active?.getAttribute?.('data-focus-key') || null;
}

function restoreFocusKey(key) {
  if (!key) {
    return;
  }
  const active = document.activeElement;
  if (active?.getAttribute?.('data-focus-key') === key) {
    return;
  }
  const target = [...document.querySelectorAll('[data-focus-key]')]
    .find((element) => element.getAttribute('data-focus-key') === key);
  if (target && typeof target.focus === 'function') {
    target.focus({ preventScroll: true });
  }
}

function describeError(error, fallback) {
  if (!error) {
    return fallback;
  }
  switch (error.type) {
    case 'not_found':
      return 'Tidak ditemukan. Repositori atau referensi mungkin privat atau tidak tersedia.';
    case 'rate_limit':
      return 'Batas laju GitHub API tercapai. Coba lagi setelah waktu reset.';
    case 'secondary_rate_limit':
      return 'Batas laju sekunder GitHub API tercapai. Tunggu sebelum mencoba lagi.';
    case 'network_error':
      return 'Gagal menghubungi GitHub API. Periksa koneksi jaringan.';
    case 'invalid_response':
      return `Respons GitHub API tidak valid: ${error.message || 'format tidak dikenali'}`;
    case 'http_error':
      return `GitHub API menolak permintaan${error.status ? ` (status ${error.status})` : ''}: ${error.message || 'tanpa detail'}`;
    case 'invalid_request':
      return error.message || 'Permintaan tidak valid.';
    case 'aborted':
      return error.message || 'Permintaan dibatalkan.';
    default:
      return error.message || fallback;
  }
}

function appendNotice(container, text, className = 'message warning') {
  const note = document.createElement('p');
  note.className = className;
  note.textContent = text;
  container.appendChild(note);
}

function renderPatch(container, patch) {
  const parsed = parsePatch(patch);
  if (!parsed.available) {
    appendNotice(
      container,
      'Patch tidak tersedia pada respons API. File mungkin biner atau perubahannya terlalu besar untuk disertakan.',
      'empty-state',
    );
    return;
  }

  const pre = document.createElement('pre');
  pre.className = 'patch';
  for (const line of parsed.lines) {
    const span = document.createElement('span');
    span.className = `patch-line patch-line-${line.type}`;
    span.dataset.lineType = line.type;
    span.textContent = line.text === '' ? ' ' : line.text;
    pre.appendChild(span);
  }
  container.appendChild(pre);

  if (parsed.truncated) {
    appendNotice(container, 'Patch ditampilkan sebagian karena melebihi batas tampilan.');
  }
}

function renderRepository(repository) {
  clearContainer(elements.repositorySummary);
  if (!repository) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Belum ada repositori yang diperiksa.';
    elements.repositorySummary.appendChild(empty);
    return;
  }

  const card = document.createElement('section');
  card.className = 'repository-card';

  const title = document.createElement('h3');
  title.textContent = repository.fullName || repository.name || 'Repositori';
  card.appendChild(title);

  if (repository.description) {
    const description = document.createElement('p');
    description.textContent = repository.description;
    card.appendChild(description);
  }

  const meta = document.createElement('div');
  meta.className = 'repository-meta';
  for (const item of [
    `Owner: ${repository.owner || '—'}`,
    `Default branch: ${repository.defaultBranch || '—'}`,
    `Stars: ${formatNumber(repository.stars)}`,
    `Forks: ${formatNumber(repository.forks)}`,
    `Open issues: ${formatNumber(repository.openIssues)}`,
    `Language: ${repository.language || '—'}`,
    `Updated: ${formatDate(repository.updatedAt)}`,
  ]) {
    meta.appendChild(createTextElement('span', item));
  }
  card.appendChild(meta);

  const repositoryHref = sanitizeExternalUrl(repository.htmlUrl);
  if (repositoryHref) {
    const link = document.createElement('a');
    link.href = repositoryHref;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Buka di GitHub';
    card.appendChild(link);
  }

  elements.repositorySummary.appendChild(card);
}

function renderRateLimit(rateLimit) {
  setText(elements.rateLimit, rateLimit ? formatRateLimit(rateLimit) : '');
}

function renderBranches(state) {
  if (!state.repository) {
    elements.branchPanel.hidden = true;
    return;
  }

  elements.branchPanel.hidden = false;
  const select = elements.branchSelect;
  select.replaceChildren();

  const names = new Set(state.branches.map((branch) => branch.name));
  if (state.selectedBranch && !names.has(state.selectedBranch)) {
    const option = document.createElement('option');
    option.value = state.selectedBranch;
    option.textContent = `${state.selectedBranch} (belum dimuat)`;
    select.appendChild(option);
  }

  for (const branch of state.branches) {
    const option = document.createElement('option');
    option.value = branch.name;
    option.textContent = branch.name;
    select.appendChild(option);
  }

  if (state.selectedBranch) {
    select.value = state.selectedBranch;
  }

  select.disabled = state.branchesLoading;
  setHidden(elements.loadMoreBranches, !state.hasMoreBranches || state.branchesLoading);
  elements.loadMoreBranches.disabled = state.branchesLoading;

  if (state.branchesLoading) {
    setText(elements.branchStatus, 'Memuat branch...');
  } else if (state.branchesError) {
    setText(elements.branchStatus, describeError(state.branchesError, 'Gagal memuat branch.'));
  } else if (state.branchesFromCache) {
    setText(elements.branchStatus, `Branch dimuat dari cache (${state.branches.length} branch).`);
  } else if (state.branches.length === 0) {
    setText(elements.branchStatus, 'Tidak ada branch yang tersedia.');
  } else {
    setText(elements.branchStatus, `${state.branches.length} branch dimuat.`);
  }
}

function renderCommits(state) {
  clearContainer(elements.commitList);

  if (state.commitsLoading && state.commits.length === 0) {
    const loading = document.createElement('li');
    loading.textContent = 'Memuat commit...';
    elements.commitList.appendChild(loading);
  } else if (state.commitsError) {
    const error = document.createElement('li');
    error.className = 'message error';
    error.textContent = describeError(state.commitsError, 'Gagal memuat commit.');
    elements.commitList.appendChild(error);
  } else if (state.commits.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = state.selectedBranch
      ? 'Tidak ada commit pada branch ini.'
      : 'Pilih branch untuk melihat commit.';
    elements.commitList.appendChild(empty);
  } else {
    for (const commit of state.commits) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'commit-button';
      button.dataset.focusKey = `timeline:${commit.sha}`;
      if (commit.sha === state.selectedCommitSha) {
        button.classList.add('is-selected');
        button.setAttribute('aria-current', 'true');
      }
      button.addEventListener('click', () => {
        controller.selectCommit(commit.sha);
      });

      const sha = document.createElement('code');
      sha.textContent = commit.shortSha;
      const author = document.createElement('span');
      author.textContent = commit.authorName || commit.authorLogin || 'Unknown author';
      const date = document.createElement('span');
      date.textContent = formatDate(commit.authorDate);
      const message = document.createElement('span');
      message.className = 'commit-message';
      message.textContent = firstLine(commit.message);

      button.append(sha, author, date, message);
      item.appendChild(button);
      elements.commitList.appendChild(item);
    }
  }

  setHidden(elements.loadMoreCommits, !state.hasMoreCommits || state.commitsLoading);
  elements.loadMoreCommits.disabled = state.commitsLoading;

  if (state.commitsLoading && state.commits.length > 0) {
    setText(elements.commitStatus, 'Memuat commit tambahan...');
  } else if (state.commitsError) {
    setText(elements.commitStatus, describeError(state.commitsError, 'Gagal memuat commit.'));
  } else if (state.commitsFromCache) {
    setText(elements.commitStatus, `Commit dimuat dari cache (${state.commits.length} commit).`);
  } else if (state.commits.length === 0) {
    setText(elements.commitStatus, '');
  } else {
    setText(elements.commitStatus, `${state.commits.length} commit dimuat.`);
  }
}

function renderCommitGraphPanel(state) {
  if (!elements.commitGraph) return;

  if (!state.commits || state.commits.length === 0) {
    clearContainer(elements.commitGraph);
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Belum ada commit untuk divisualisasikan.';
    elements.commitGraph.appendChild(empty);
    setText(elements.graphStatus, '');
    if (elements.graphSummary) elements.graphSummary.textContent = '';
    return;
  }

  const graph = buildCommitGraph(state.commits, {
    selectedSha: state.selectedCommitSha,
    maxNodes: 100,
  });
  renderCommitGraph(elements.commitGraph, graph, {
    selectedSha: state.selectedCommitSha,
    onSelect: (sha) => controller.selectCommit(sha),
  });

  const statusParts = [graph.partial
    ? 'Graph ini berdasarkan commit yang sudah dimuat; sebagian parent mungkin belum tersedia.'
    : 'Graph dibangun dari relasi parent commit yang tersedia pada data yang dimuat.'];
  if (graph.truncated) {
    statusParts.push(`Hanya ${graph.displayedCount} dari ${graph.totalCount} commit ditampilkan.`);
  }
  if (graph.hasMissingParents) {
    statusParts.push(`${graph.missingParents.length} parent belum dimuat atau tidak tersedia.`);
  }
  setText(elements.graphStatus, statusParts.join(' '));
  if (elements.graphSummary) {
    elements.graphSummary.textContent = graph.truncated
      ? `${graph.displayedCount}/${graph.totalCount} commit ditampilkan`
      : `${graph.displayedCount} commit`;
  }
}

function renderCommitDetail(state) {
  clearContainer(elements.commitDetail);

  if (!state.selectedCommitSha) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Pilih commit untuk melihat detail dan file yang berubah.';
    elements.commitDetail.appendChild(empty);
    return;
  }

  if (state.commitDetailStatus === 'loading') {
    const loading = document.createElement('p');
    loading.className = 'empty-state';
    loading.textContent = 'Memuat detail commit...';
    elements.commitDetail.appendChild(loading);
    return;
  }

  if (state.commitDetailStatus === 'error') {
    const error = document.createElement('p');
    error.className = 'message error';
    error.textContent = describeError(state.commitDetailError, 'Gagal memuat detail commit.');
    elements.commitDetail.appendChild(error);
    return;
  }

  if (state.commitDetailStatus === 'cancelled') {
    const cancelled = document.createElement('p');
    cancelled.className = 'empty-state';
    cancelled.textContent = 'Pemuatan detail commit dibatalkan.';
    elements.commitDetail.appendChild(cancelled);
    return;
  }

  const detail = state.commitDetail;
  if (!detail) {
    return;
  }

  const title = document.createElement('h4');
  title.textContent = detail.sha;
  elements.commitDetail.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'repository-meta';
  for (const item of [
    `Author: ${detail.authorName || detail.authorLogin || '—'}`,
    `Date: ${formatDate(detail.authorDate)}`,
    `Parents: ${detail.parentShas.length > 0 ? detail.parentShas.map((sha) => sha.slice(0, 7)).join(', ') : 'none'}`,
  ]) {
    meta.appendChild(createTextElement('span', item));
  }
  elements.commitDetail.appendChild(meta);

  const detailHref = sanitizeExternalUrl(detail.htmlUrl);
  if (detailHref) {
    const link = document.createElement('a');
    link.href = detailHref;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Buka commit di GitHub';
    elements.commitDetail.appendChild(link);
  }

  const message = document.createElement('pre');
  message.className = 'commit-message-full';
  message.textContent = detail.message || '';
  elements.commitDetail.appendChild(message);

  if (detail.stats) {
    const stats = document.createElement('p');
    stats.className = 'commit-stats';
    stats.textContent = `+${detail.stats.additions} -${detail.stats.deletions} (${detail.stats.total} changes)`;
    elements.commitDetail.appendChild(stats);
  }

  const filesTitle = document.createElement('h4');
  filesTitle.textContent = 'Changed files';
  elements.commitDetail.appendChild(filesTitle);

  if (detail.files.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Tidak ada daftar file yang tersedia untuk commit ini.';
    elements.commitDetail.appendChild(empty);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'changed-files';
  for (const file of detail.files) {
    const item = document.createElement('li');
    const status = document.createElement('span');
    status.className = 'file-status';
    status.textContent = file.status;
    const name = document.createElement('span');
    name.className = 'file-name';
    name.textContent = file.filename;
    const counts = document.createElement('span');
    counts.className = 'file-counts';
    counts.textContent = `+${file.additions} -${file.deletions}`;
    item.append(status, name, counts);

    const patchHolder = document.createElement('div');
    patchHolder.className = 'patch-holder';
    renderPatch(patchHolder, file.patch);
    item.appendChild(patchHolder);

    list.appendChild(item);
  }
  elements.commitDetail.appendChild(list);

  if (detail.files.length >= 300) {
    appendNotice(
      elements.commitDetail,
      'Daftar file commit mungkin dibatasi hingga 300 file oleh GitHub API.',
    );
  }
}

let selectedComparisonFile = null;

function firstLine(value) {
  return String(value ?? '').split(/\r?\n/, 1)[0] || '';
}

function comparisonRefs(state) {
  const refs = [];
  const seen = new Set();
  for (const branch of state.branches || []) {
    if (branch.name && !seen.has(branch.name)) {
      seen.add(branch.name);
      refs.push({ value: branch.name, label: `branch: ${branch.name}` });
    }
  }
  for (const commit of state.commits || []) {
    if (commit.sha && !seen.has(commit.sha)) {
      seen.add(commit.sha);
      refs.push({ value: commit.sha, label: `commit: ${commit.shortSha}` });
    }
  }
  if (state.selectedBranch && !seen.has(state.selectedBranch)) {
    refs.push({ value: state.selectedBranch, label: `branch: ${state.selectedBranch}` });
  }
  return refs;
}

function renderComparisonRefs(state) {
  if (!elements.comparisonBase || !elements.comparisonHead) return;

  const refs = comparisonRefs(state);
  for (const select of [elements.comparisonBase, elements.comparisonHead]) {
    const previous = select.value;
    select.replaceChildren();
    if (refs.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Belum ada referensi';
      select.appendChild(option);
      select.disabled = true;
      continue;
    }
    select.disabled = false;
    for (const ref of refs) {
      const option = document.createElement('option');
      option.value = ref.value;
      option.textContent = ref.label;
      select.appendChild(option);
    }
    if (refs.some((ref) => ref.value === previous)) {
      select.value = previous;
    } else if (state.comparisonBase && refs.some((ref) => ref.value === state.comparisonBase)) {
      select.value = state.comparisonBase;
    } else if (state.selectedBranch && refs.some((ref) => ref.value === state.selectedBranch)) {
      select.value = state.selectedBranch;
    } else {
      select.value = refs[0].value;
    }
  }
}

function renderComparison(state) {
  if (!elements.comparisonSummary) return;

  renderComparisonRefs(state);

  if (!state.repository) {
    setText(elements.comparisonStatus, 'Periksa repositori terlebih dahulu.');
    clearContainer(elements.comparisonSummary);
    clearContainer(elements.comparisonCommitList);
    clearContainer(elements.comparisonFileList);
    clearContainer(elements.comparisonDiff);
    setHidden(elements.loadMoreComparison, true);
    return;
  }

  if (state.comparisonLoading) {
    setText(elements.comparisonStatus, 'Membandingkan referensi...');
  } else if (state.comparisonError) {
    setText(elements.comparisonStatus, describeError(state.comparisonError, 'Perbandingan gagal.'));
  } else if (state.comparison) {
    setText(elements.comparisonStatus, state.comparisonFromCache
      ? 'Hasil perbandingan dimuat dari cache.'
      : 'Perbandingan selesai.');
  } else {
    setText(elements.comparisonStatus, 'Pilih base dan head, lalu tekan Compare.');
  }

  clearContainer(elements.comparisonSummary);
  clearContainer(elements.comparisonCommitList);
  clearContainer(elements.comparisonFileList);
  clearContainer(elements.comparisonDiff);

  const comparison = state.comparison;
  if (!comparison) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Belum ada hasil perbandingan.';
    elements.comparisonSummary.appendChild(empty);
    setHidden(elements.loadMoreComparison, true);
    return;
  }

  const summary = document.createElement('div');
  summary.className = 'repository-meta';
  for (const item of [
    `Status: ${comparison.status}`,
    `Ahead: ${formatNumber(comparison.aheadBy)}`,
    `Behind: ${formatNumber(comparison.behindBy)}`,
    `Commits: ${formatNumber(comparison.totalCommits)}`,
    `Files: ${comparison.filesAvailable ? formatNumber(comparison.files.length) : 'tidak tersedia'}`,
  ]) {
    summary.appendChild(createTextElement('span', item));
  }
  if (comparison.filesPossiblyTruncated) {
    const note = document.createElement('p');
    note.className = 'message warning';
    note.textContent = 'Daftar file mungkin terbatas hingga 300 file oleh GitHub API.';
    summary.appendChild(note);
  }
  elements.comparisonSummary.appendChild(summary);

  if (comparison.commits.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = 'Tidak ada commit yang berbeda.';
    elements.comparisonCommitList.appendChild(empty);
  } else {
    for (const commit of comparison.commits) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'commit-button';
      button.dataset.focusKey = `comparison-commit:${commit.sha}`;
      button.addEventListener('click', () => {
        controller.selectCommit(commit.sha);
      });
      const sha = document.createElement('code');
      sha.textContent = commit.shortSha;
      const message = document.createElement('span');
      message.className = 'commit-message';
      message.textContent = firstLine(commit.message);
      button.append(sha, message);
      item.appendChild(button);
      elements.comparisonCommitList.appendChild(item);
    }
  }

  setHidden(elements.loadMoreComparison, !state.hasMoreComparisonCommits || state.comparisonLoading);
  elements.loadMoreComparison.disabled = state.comparisonLoading;

  if (comparison.files.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = comparison.filesAvailable
      ? 'Tidak ada file yang berubah.'
      : 'Daftar file tidak tersedia pada respons ini.';
    elements.comparisonFileList.appendChild(empty);
  } else {
    if (selectedComparisonFile === null || !comparison.files.some((file) => file.filename === selectedComparisonFile)) {
      selectedComparisonFile = comparison.files[0].filename;
    }

    for (const file of comparison.files) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'file-button';
      button.dataset.focusKey = `file:${file.filename}`;
      if (file.filename === selectedComparisonFile) {
        button.classList.add('is-selected');
        button.setAttribute('aria-current', 'true');
      }
      button.addEventListener('click', () => {
        selectedComparisonFile = file.filename;
        const focusKey = button.dataset.focusKey;
        renderComparison(controller.getState());
        restoreFocusKey(focusKey);
      });

      const status = document.createElement('span');
      status.className = 'file-status';
      status.textContent = file.status;
      const name = document.createElement('span');
      name.className = 'file-name';
      name.textContent = file.filename;
      const counts = document.createElement('span');
      counts.className = 'file-counts';
      counts.textContent = `+${file.additions} -${file.deletions}`;
      button.append(status, name, counts);
      item.appendChild(button);
      elements.comparisonFileList.appendChild(item);
    }
  }

  const selectedFile = comparison.files.find((file) => file.filename === selectedComparisonFile);
  if (!selectedFile) {
    delete elements.comparisonDiff.dataset.scrollKey;
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Pilih file untuk melihat diff.';
    elements.comparisonDiff.appendChild(empty);
    return;
  }

  elements.comparisonDiff.dataset.scrollKey = selectedFile.filename;

  const title = document.createElement('h4');
  title.textContent = selectedFile.filename;
  elements.comparisonDiff.appendChild(title);

  if (selectedFile.previousFilename) {
    const previous = document.createElement('p');
    previous.className = 'empty-state';
    previous.textContent = `Sebelumnya: ${selectedFile.previousFilename}`;
    elements.comparisonDiff.appendChild(previous);
  }

  renderPatch(elements.comparisonDiff, selectedFile.patch);
}

function renderClearedPanels(state) {
  renderBranches(state);
  renderCommits(state);
  renderCommitGraphPanel(state);
  renderComparison(state);
  renderCommitDetail(state);
}

function renderState(state) {
  const focusKey = captureFocusKey();
  const scrollPositions = captureScrollPositions();
  renderStateContent(state);
  restoreScrollPositions(scrollPositions);
  restoreFocusKey(focusKey);
}

function renderStateContent(state) {
  if (elements.urlInput) {
    if (state.status === 'invalid_url') {
      elements.urlInput.setAttribute('aria-invalid', 'true');
    } else {
      elements.urlInput.removeAttribute('aria-invalid');
    }
  }

  announceStatus(
    elements.appStatus,
    state.status === 'loading'
      ? 'Memeriksa repositori...'
      : state.status === 'success'
        ? 'Repositori berhasil diperiksa.'
        : state.status === 'error'
          ? describeError(state.error, 'Pemeriksaan repositori gagal.')
          : state.status === 'invalid_url'
            ? (state.error?.message || 'URL repositori tidak valid.')
            : state.status === 'cancelled'
              ? 'Pemeriksaan repositori dibatalkan.'
              : 'Siap. Masukkan URL repositori GitHub publik.',
    state.status === 'error' || state.status === 'invalid_url' ? 'error' : 'idle',
  );

  if (state.status === 'loading') {
    setHidden(elements.cancelButton, false);
    setText(elements.validationMessage, '');
    clearContainer(elements.repositorySummary);
    const loading = document.createElement('p');
    loading.className = 'empty-state';
    loading.textContent = 'Memeriksa repositori...';
    elements.repositorySummary.appendChild(loading);
    renderClearedPanels(state);
    return;
  }

  setHidden(elements.cancelButton, true);

  if (state.status === 'invalid_url') {
    setText(elements.validationMessage, state.error?.message || 'URL repositori tidak valid.');
    clearContainer(elements.repositorySummary);
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Masukkan URL repositori GitHub yang valid.';
    elements.repositorySummary.appendChild(empty);
    renderClearedPanels(state);
    return;
  }

  if (state.status === 'error') {
    const errorMessage = describeError(state.error, 'Pemeriksaan repositori gagal.');
    setText(elements.validationMessage, errorMessage);
    clearContainer(elements.repositorySummary);
    const error = document.createElement('p');
    error.className = 'message error';
    error.textContent = errorMessage;
    elements.repositorySummary.appendChild(error);
    renderRateLimit(state.rateLimit);
    renderClearedPanels(state);
    return;
  }

  if (state.status === 'cancelled') {
    setText(elements.validationMessage, 'Pemeriksaan repositori dibatalkan.');
    clearContainer(elements.repositorySummary);
    const cancelled = document.createElement('p');
    cancelled.className = 'empty-state';
    cancelled.textContent = 'Pemeriksaan repositori dibatalkan.';
    elements.repositorySummary.appendChild(cancelled);
    renderRateLimit(state.rateLimit);
    renderClearedPanels(state);
    return;
  }

  setText(elements.validationMessage, '');
  if (state.status === 'success') {
    renderRepository(state.repository);
    renderRateLimit(state.rateLimit);
    renderBranches(state);
    renderCommits(state);
    renderCommitGraphPanel(state);
    renderComparison(state);
    renderCommitDetail(state);
  } else {
    clearContainer(elements.repositorySummary);
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Belum ada repositori yang diperiksa.';
    elements.repositorySummary.appendChild(empty);
    renderClearedPanels(state);
  }
}

function initializeElements() {
  collectElements();
}

function initializeEvents() {
  elements.form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const url = elements.urlInput?.value || '';
    const validation = validateRepositoryUrl(url);
    if (validation.ok) {
      elements.urlInput.value = validation.url;
    }
    await controller.checkRepository(validation.ok ? validation.url : url);
  });

  elements.branchSelect?.addEventListener('change', () => {
    controller.selectBranch(elements.branchSelect.value);
  });

  elements.loadMoreBranches?.addEventListener('click', () => {
    controller.loadMoreBranches();
  });

  elements.loadMoreCommits?.addEventListener('click', () => {
    controller.loadMoreCommits();
  });

  for (const select of [elements.comparisonBase, elements.comparisonHead]) {
    select?.addEventListener('change', () => {
      selectedComparisonFile = null;
      controller.setComparisonRefs(
        elements.comparisonBase?.value || '',
        elements.comparisonHead?.value || '',
      );
    });
  }

  elements.compareButton?.addEventListener('click', () => {
    selectedComparisonFile = null;
    controller.compareReferences(
      elements.comparisonBase?.value || '',
      elements.comparisonHead?.value || '',
    );
  });

  elements.loadMoreComparison?.addEventListener('click', () => {
    controller.loadMoreComparisonCommits();
  });

  elements.cancelButton?.addEventListener('click', () => {
    controller.cancel();
  });

  elements.resetButton?.addEventListener('click', () => {
    controller.reset();
    elements.urlInput.value = '';
  });

  controller.subscribe((state) => {
    renderState(state);
  });
}

async function initializeApp() {
  const apiClient = createGitHubApiClient();
  controller = createGitScopeController({ apiClient });
  initializeElements();
  initializeEvents();
  renderState(controller.getState());
}

if (typeof document !== 'undefined') {
  void initializeApp();
}

export { initializeApp, createGitScopeController, controller };
