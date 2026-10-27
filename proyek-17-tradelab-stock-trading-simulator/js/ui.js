const SVG_NS = 'http://www.w3.org/2000/svg';

export function formatMoney(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function renderMarketTable(container, stocks, selectedSymbol, onSelect) {
  if (!container) {
    return;
  }

  container.replaceChildren();

  if (stocks.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Tidak ada saham yang cocok dengan pencarian atau filter.';
    container.appendChild(empty);
    return;
  }

  const table = document.createElement('table');
  table.className = 'stock-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  for (const title of ['Simbol', 'Nama', 'Sektor', 'Harga', 'Perubahan']) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = title;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const stock of stocks) {
    const row = document.createElement('tr');
    if (stock.symbol === selectedSymbol) {
      row.classList.add('is-selected');
    }

    const symbolCell = document.createElement('td');
    const symbolButton = document.createElement('button');
    symbolButton.type = 'button';
    symbolButton.className = 'stock-button';
    symbolButton.textContent = stock.symbol;
    symbolButton.addEventListener('click', () => onSelect(stock.symbol));
    symbolCell.appendChild(symbolButton);
    row.appendChild(symbolCell);

    const nameCell = document.createElement('td');
    nameCell.textContent = stock.name;
    row.appendChild(nameCell);

    const sectorCell = document.createElement('td');
    sectorCell.textContent = stock.sector;
    row.appendChild(sectorCell);

    const priceCell = document.createElement('td');
    priceCell.textContent = formatMoney(stock.price);
    row.appendChild(priceCell);

    const changeCell = document.createElement('td');
    changeCell.textContent = formatPercent(stock.changePercent);
    changeCell.className = stock.changePercent >= 0 ? 'positive' : 'negative';
    row.appendChild(changeCell);

    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

export function renderChart(container, series) {
  if (!container) {
    return;
  }

  container.replaceChildren();

  if (!Array.isArray(series) || series.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Grafik harga belum tersedia.';
    container.appendChild(empty);
    return;
  }

  const width = 320;
  const height = 180;
  const padding = 24;
  const closes = series.map((item) => item.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = Math.max(1, max - min);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'chart');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Grafik harga 30 hari');

  const grid = document.createElementNS(SVG_NS, 'line');
  grid.setAttribute('class', 'grid');
  grid.setAttribute('x1', String(padding));
  grid.setAttribute('y1', String(height - padding));
  grid.setAttribute('x2', String(width - padding));
  grid.setAttribute('y2', String(height - padding));
  svg.appendChild(grid);

  const points = series.map((item, index) => {
    const x = padding + (index / Math.max(1, series.length - 1)) * (width - padding * 2);
    const y = height - padding - ((item.close - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  const polyline = document.createElementNS(SVG_NS, 'polyline');
  polyline.setAttribute('points', points);
  svg.appendChild(polyline);

  const firstLabel = document.createElementNS(SVG_NS, 'text');
  firstLabel.setAttribute('class', 'label');
  firstLabel.setAttribute('x', String(padding));
  firstLabel.setAttribute('y', String(height - 6));
  firstLabel.textContent = series[0].date.slice(5);
  svg.appendChild(firstLabel);

  const lastLabel = document.createElementNS(SVG_NS, 'text');
  lastLabel.setAttribute('class', 'label');
  lastLabel.setAttribute('x', String(width - padding));
  lastLabel.setAttribute('y', String(height - 6));
  lastLabel.setAttribute('text-anchor', 'end');
  lastLabel.textContent = series[series.length - 1].date.slice(5);
  svg.appendChild(lastLabel);

  container.appendChild(svg);
}

export function renderStockDetail(container, stock) {
  if (!container || !stock) {
    return;
  }

  container.replaceChildren();

  const title = document.createElement('h3');
  title.textContent = `${stock.symbol} — ${stock.name}`;
  container.appendChild(title);

  const meta = document.createElement('p');
  meta.textContent = `Sektor: ${stock.sector}. Harga terakhir: ${formatMoney(stock.price)}.`;
  container.appendChild(meta);

  const grid = document.createElement('div');
  grid.className = 'detail-grid';

  const cards = [
    { label: 'Harga terakhir', value: formatMoney(stock.price) },
    { label: 'Perubahan harian', value: formatPercent(stock.changePercent) },
    { label: 'Harga awal 30 hari', value: formatMoney(stock.series[0].close) },
    { label: 'Harga tertinggi 30 hari', value: formatMoney(Math.max(...stock.series.map((item) => item.close))) },
  ];

  for (const card of cards) {
    const article = document.createElement('article');
    article.className = 'detail-card';

    const label = document.createElement('span');
    label.textContent = card.label;
    article.appendChild(label);

    const value = document.createElement('strong');
    value.textContent = card.value;
    article.appendChild(value);

    grid.appendChild(article);
  }
  container.appendChild(grid);

  const chartContainer = document.createElement('div');
  chartContainer.className = 'chart';
  container.appendChild(chartContainer);
  renderChart(chartContainer, stock.series);

  const note = document.createElement('p');
  note.className = 'note';
  note.textContent = 'Data harga bersifat sintetis untuk simulasi. Gunakan tab Portofolio untuk transaksi.';
  container.appendChild(note);
}