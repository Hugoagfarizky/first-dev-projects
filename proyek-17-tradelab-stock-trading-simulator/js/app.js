import { renderMarketTable, renderStockDetail } from './ui.js';
import { formatMoney } from './ui.js';
import { getStockCatalog, getStockBySymbol } from './market-data.js';
import { createTradingController } from './trading-controller.js';

const stocks = getStockCatalog();

const state = {
  selectedSymbol: stocks[0]?.symbol ?? '',
  search: '',
  sector: 'Semua',
  activeView: 'market',
};

const elements = {
  status: document.getElementById('app-status'),
  search: document.getElementById('search-stock'),
  sectorFilter: document.getElementById('sector-filter'),
  tableBody: document.getElementById('stock-table-body'),
  marketEmpty: document.getElementById('market-empty'),
  detail: document.getElementById('stock-detail'),
  tabs: Array.from(document.querySelectorAll('.tab-button')),
  views: {
    market: document.getElementById('view-market'),
    portfolio: document.getElementById('view-portfolio'),
    history: document.getElementById('view-history'),
  },
  storageStatus: document.getElementById('storage-status'),
  portfolioSummary: document.getElementById('portfolio-summary'),
  tradeForm: document.getElementById('trade-form'),
  tradeSymbol: document.getElementById('trade-symbol'),
  tradeQuantity: document.getElementById('trade-quantity'),
  tradePrice: document.getElementById('trade-price'),
  buyButton: document.getElementById('buy-button'),
  sellButton: document.getElementById('sell-button'),
  tradeMessage: document.getElementById('trade-message'),
  positionTableBody: document.getElementById('position-table-body'),
  watchlistSymbol: document.getElementById('watchlist-symbol'),
  watchlistAdd: document.getElementById('watchlist-add'),
  watchlistList: document.getElementById('watchlist-list'),
  resetPortfolio: document.getElementById('reset-portfolio'),
  historyTableBody: document.getElementById('history-table-body'),
  historyEmpty: document.getElementById('history-empty'),
};

const controller = createTradingController({ now: () => new Date().toISOString() });

function filteredStocks() {
  const query = state.search.trim().toLowerCase();
  return stocks.filter((stock) => {
    const matchesSector = state.sector === 'Semua' || stock.sector === state.sector;
    const matchesQuery = query === ''
      || stock.symbol.toLowerCase().includes(query)
      || stock.name.toLowerCase().includes(query);
    return matchesSector && matchesQuery;
  });
}

function updateStatus(text) {
  if (elements.status) {
    elements.status.textContent = text;
  }
}

function renderSectorFilter() {
  if (!elements.sectorFilter) {
    return;
  }
  for (const sector of [...new Set(stocks.map((stock) => stock.sector))]) {
    const option = document.createElement('option');
    option.value = sector;
    option.textContent = sector;
    elements.sectorFilter.appendChild(option);
  }
}

function renderTradeSymbolOptions() {
  if (!elements.tradeSymbol) {
    return;
  }
  elements.tradeSymbol.replaceChildren();
  for (const stock of stocks) {
    const option = document.createElement('option');
    option.value = stock.symbol;
    option.textContent = `${stock.symbol} — ${stock.name}`;
    elements.tradeSymbol.appendChild(option);
  }
  if (state.selectedSymbol) {
    elements.tradeSymbol.value = state.selectedSymbol;
  }
  updateTradePrice();
}

function updateTradePrice() {
  const stock = getStockBySymbol(elements.tradeSymbol?.value || state.selectedSymbol);
  if (elements.tradePrice) {
    elements.tradePrice.value = stock ? formatMoney(stock.price) : '';
  }
}

function renderSummary() {
  if (!elements.portfolioSummary) {
    return;
  }
  const summary = controller.getSummary();
  elements.portfolioSummary.replaceChildren();
  const cards = [
    { label: 'Saldo kas', value: formatMoney(summary.cash) },
    { label: 'Nilai saham', value: formatMoney(summary.marketValue) },
    { label: 'Total ekuitas', value: formatMoney(summary.totalEquity) },
    { label: 'Realized P/L', value: formatMoney(summary.realizedProfitLoss) },
    { label: 'Unrealized P/L', value: formatMoney(summary.unrealizedProfitLoss) },
  ];
  for (const card of cards) {
    const article = document.createElement('article');
    article.className = 'summary-card';
    const label = document.createElement('span');
    label.textContent = card.label;
    const value = document.createElement('strong');
    value.textContent = card.value;
    article.append(label, value);
    elements.portfolioSummary.appendChild(article);
  }
}

function renderPositions() {
  if (!elements.positionTableBody) {
    return;
  }
  const summary = controller.getSummary();
  elements.positionTableBody.replaceChildren();
  for (const position of summary.positions) {
    const row = document.createElement('tr');
    const cells = [
      position.symbol,
      String(position.quantity),
      formatMoney(position.averageCost),
      position.marketPrice === null ? 'N/A' : formatMoney(position.marketPrice),
      formatMoney(position.marketValue),
      position.unrealizedProfitLoss === null ? 'N/A' : formatMoney(position.unrealizedProfitLoss),
    ];
    for (const value of cells) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.appendChild(cell);
    }
    elements.positionTableBody.appendChild(row);
  }
}

function renderHistory() {
  if (!elements.historyTableBody) {
    return;
  }
  const portfolio = controller.getPortfolio();
  elements.historyTableBody.replaceChildren();
  if (portfolio.transactions.length === 0) {
    if (elements.historyEmpty) {
      elements.historyEmpty.hidden = false;
    }
    return;
  }
  if (elements.historyEmpty) {
    elements.historyEmpty.hidden = true;
  }
  for (const transaction of portfolio.transactions) {
    const row = document.createElement('tr');
    const cells = [
      transaction.timestamp,
      transaction.type === 'buy' ? 'Beli' : 'Jual',
      transaction.symbol,
      String(transaction.quantity),
      formatMoney(transaction.price),
      formatMoney(transaction.total),
    ];
    for (const value of cells) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.appendChild(cell);
    }
    elements.historyTableBody.appendChild(row);
  }
}

function renderWatchlist() {
  if (!elements.watchlistList || !elements.watchlistSymbol) {
    return;
  }
  elements.watchlistSymbol.replaceChildren();
  for (const stock of stocks) {
    const option = document.createElement('option');
    option.value = stock.symbol;
    option.textContent = stock.symbol;
    elements.watchlistSymbol.appendChild(option);
  }

  elements.watchlistList.replaceChildren();
  for (const symbol of controller.getWatchlist()) {
    const item = document.createElement('li');
    const text = document.createElement('span');
    text.textContent = symbol;
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.textContent = 'Hapus';
    removeButton.addEventListener('click', () => {
      controller.removeFromWatchlist(symbol);
      renderWatchlist();
    });
    item.append(text, removeButton);
    elements.watchlistList.appendChild(item);
  }
}

function renderStorageStatus() {
  if (!elements.storageStatus) {
    return;
  }
  const status = controller.getStorageStatus();
  const autosaveStatus = controller.getAutosaveStatus().state;
  let text = '';
  if (status === 'loaded') {
    text = `Data portofolio dimuat dari storage. Status penyimpanan: ${autosaveStatus}.`;
  } else if (status === 'empty') {
    text = `Storage kosong; sesi baru dimulai. Status penyimpanan: ${autosaveStatus}.`;
  } else if (status === 'corrupt' || status === 'unsupported-schema') {
    text = `Data storage ${status}. Data tidak ditimpa otomatis; lakukan transaksi/reset untuk membuat data baru.`;
  } else {
    text = 'Storage tidak tersedia atau gagal dibaca; sesi hanya berada di memori.';
  }
  elements.storageStatus.textContent = text;
}

function renderPortfolioView() {
  renderSummary();
  renderPositions();
  renderHistory();
  renderWatchlist();
  renderStorageStatus();
}

function render() {
  const visibleStocks = filteredStocks();
  const selectedStock = stocks.find((stock) => stock.symbol === state.selectedSymbol) ?? visibleStocks[0] ?? stocks[0];

  if (selectedStock && state.selectedSymbol !== selectedStock.symbol) {
    state.selectedSymbol = selectedStock.symbol;
  }

  renderMarketTable(elements.tableBody, visibleStocks, state.selectedSymbol, (symbol) => {
    state.selectedSymbol = symbol;
    render();
  });

  if (elements.marketEmpty) {
    elements.marketEmpty.hidden = visibleStocks.length > 0;
  }

  if (elements.detail && selectedStock) {
    renderStockDetail(elements.detail, selectedStock);
  }

  if (elements.tradeSymbol && state.selectedSymbol) {
    elements.tradeSymbol.value = state.selectedSymbol;
    updateTradePrice();
  }

  renderPortfolioView();

  const autosaveState = controller.getAutosaveStatus().state;
  updateStatus(`Data sintetis dimuat: ${stocks.length} saham. Status penyimpanan: ${autosaveState}. Pilih saham untuk melihat detail.`);
}

function setActiveView(viewName) {
  state.activeView = viewName;
  for (const [name, element] of Object.entries(elements.views)) {
    if (element) {
      element.hidden = name !== viewName;
    }
  }
  for (const button of elements.tabs) {
    button.dataset.view = button.id.replace('tab-', '');
    button.setAttribute('aria-selected', String(button.dataset.view === viewName));
  }
  if (viewName === 'portfolio' || viewName === 'history') {
    render();
  }
}

function initializeTabs() {
  for (const button of elements.tabs) {
    button.dataset.view = button.id.replace('tab-', '');
    button.addEventListener('click', () => {
      setActiveView(button.dataset.view);
    });
  }
  setActiveView(state.activeView);
}

function initializeFilters() {
  elements.search?.addEventListener('input', (event) => {
    state.search = event.target.value;
    render();
  });

  elements.sectorFilter?.addEventListener('change', (event) => {
    state.sector = event.target.value;
    render();
  });
}

async function handleTrade(type) {
  const symbol = elements.tradeSymbol?.value || state.selectedSymbol;
  const quantity = Number.parseInt(elements.tradeQuantity?.value ?? '', 10);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    if (elements.tradeMessage) {
      elements.tradeMessage.textContent = 'Jumlah transaksi harus berupa integer positif.';
    }
    return;
  }

  const method = type === 'buy' ? controller.buy.bind(controller) : controller.sell.bind(controller);
  const result = await method({ symbol, quantity });
  if (elements.tradeMessage) {
    elements.tradeMessage.textContent = result.ok
      ? `${type === 'buy' ? 'Beli' : 'Jual'} ${quantity} ${symbol} berhasil.`
      : result.error;
  }
  render();
}

function initializeTradeForm() {
  elements.tradeSymbol?.addEventListener('change', () => {
    state.selectedSymbol = elements.tradeSymbol.value;
    updateTradePrice();
    render();
  });
  elements.buyButton?.addEventListener('click', () => {
    void handleTrade('buy');
  });
  elements.sellButton?.addEventListener('click', () => {
    void handleTrade('sell');
  });
}

function initializeWatchlist() {
  elements.watchlistAdd?.addEventListener('click', () => {
    const symbol = elements.watchlistSymbol?.value;
    const result = controller.addToWatchlist(symbol);
    if (!result.ok && elements.tradeMessage) {
      elements.tradeMessage.textContent = result.error;
    }
    renderWatchlist();
  });
}

function initializeReset() {
  elements.resetPortfolio?.addEventListener('click', async () => {
    const confirmed = globalThis.confirm('Reset portofolio ke saldo awal? Transaksi akan dihapus.');
    if (!confirmed) {
      return;
    }
    await controller.reset();
    if (elements.tradeMessage) {
      elements.tradeMessage.textContent = 'Portofolio telah direset.';
    }
    render();
  });
}

async function initializeApp() {
  renderSectorFilter();
  renderTradeSymbolOptions();
  initializeTabs();
  initializeFilters();
  initializeTradeForm();
  initializeWatchlist();
  initializeReset();

  await controller.init();
  render();
}

if (typeof document !== 'undefined') {
  void initializeApp();
}

export { initializeApp, stocks, state, controller };