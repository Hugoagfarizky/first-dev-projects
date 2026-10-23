import { parseNumericCell } from "./data-analyzer.js";

const collator = new Intl.Collator("id", { numeric: true, sensitivity: "base" });

export function compareCellValues(a, b) {
  const aNumber = parseNumericCell(a);
  const bNumber = parseNumericCell(b);

  if (aNumber !== null && bNumber !== null) {
    return aNumber - bNumber;
  }

  if (aNumber !== null) {
    return -1;
  }

  if (bNumber !== null) {
    return 1;
  }

  return collator.compare(String(a), String(b));
}

export function compareEntries(a, b, columnIndex, direction = 1) {
  const aEmpty = String(a.row[columnIndex] ?? "").trim() === "";
  const bEmpty = String(b.row[columnIndex] ?? "").trim() === "";

  if (aEmpty || bEmpty) {
    if (aEmpty && bEmpty) {
      return 0;
    }

    // Sel kosong selalu berada di akhir, baik untuk urutan naik maupun turun.
    return aEmpty ? 1 : -1;
  }

  const comparison = compareCellValues(a.row[columnIndex], b.row[columnIndex]) * direction;
  return comparison === 0 ? 0 : comparison;
}

export class DataTable {
  constructor(elements, { onStateChange = null } = {}) {
    this.elements = elements;
    this.onStateChange = onStateChange;
    this.dataset = null;
    this.filteredEntries = [];
    this.query = "";
    this.searchTimer = null;
    this.state = {
      page: 1,
      pageSize: 10,
      sortIndex: null,
      sortDirection: "asc",
    };

    this.bindEvents();
    this.showEmptyState("Impor CSV atau muat data contoh untuk mulai menjelajah data.");
  }

  bindEvents() {
    this.elements.search.addEventListener("input", () => {
      this.clearSearchTimer();
      this.searchTimer = window.setTimeout(() => {
        this.searchTimer = null;
        this.applyQuery(this.elements.search.value);
      }, 160);
    });

    this.elements.search.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.clearSearchTimer();
        this.applyQuery(this.elements.search.value);
      }
    });

    this.elements.pageSize.addEventListener("change", () => {
      this.state.pageSize = Number(this.elements.pageSize.value) || 10;
      this.state.page = 1;
      this.render();
    });

    this.elements.prev.addEventListener("click", () => {
      if (this.state.page > 1) {
        this.state.page -= 1;
        this.render();
      }
    });

    this.elements.next.addEventListener("click", () => {
      if (this.state.page < this.pageCount()) {
        this.state.page += 1;
        this.render();
      }
    });
  }

  setDataset(dataset) {
    this.clearSearchTimer();
    this.dataset = dataset;
    this.query = "";
    this.filteredEntries = dataset.rows.map((row, index) => ({ row, index }));
    this.state.page = 1;
    this.state.sortIndex = null;
    this.state.sortDirection = "asc";
    this.elements.search.value = "";
    this.elements.search.disabled = false;
    this.elements.pageSize.disabled = false;
    this.elements.table.hidden = false;
    this.elements.emptyState.hidden = true;
    this.buildHeader();
    this.render();
  }

  showEmptyState(message) {
    this.clearSearchTimer();
    this.dataset = null;
    this.filteredEntries = [];
    this.query = "";
    this.elements.search.value = "";
    this.elements.search.disabled = true;
    this.elements.pageSize.disabled = true;
    this.elements.table.hidden = true;
    this.elements.emptyState.hidden = false;
    this.elements.emptyState.textContent = message;
    this.elements.head.replaceChildren();
    this.elements.body.replaceChildren();
    this.elements.resultCount.textContent = "Belum ada data.";
    this.elements.pageInfo.textContent = "Halaman 1 dari 1";
    this.elements.prev.disabled = true;
    this.elements.next.disabled = true;
    this.emitState();
  }

  applyQuery(rawQuery) {
    if (!this.dataset) {
      return;
    }

    this.query = String(rawQuery ?? "").trim();
    const query = this.query.toLocaleLowerCase("id");

    this.filteredEntries = this.dataset.rows
      .map((row, index) => ({ row, index }))
      .filter((entry) => {
        if (query === "") {
          return true;
        }

        return entry.row.some((cell) =>
          String(cell ?? "")
            .toLocaleLowerCase("id")
            .includes(query),
        );
      });

    this.state.page = 1;
    this.sortEntries();
    this.render();
  }

  sortEntries() {
    if (this.state.sortIndex === null) {
      return;
    }

    const columnIndex = this.state.sortIndex;
    const direction = this.state.sortDirection === "asc" ? 1 : -1;

    this.filteredEntries.sort(
      (a, b) => compareEntries(a, b, columnIndex, direction) || a.index - b.index,
    );
  }

  buildHeader() {
    const row = document.createElement("tr");
    this.headerButtons = [];

    this.dataset.headers.forEach((header, index) => {
      const th = document.createElement("th");
      th.scope = "col";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "sort-button";
      button.dataset.columnIndex = String(index);

      const label = document.createElement("span");
      label.textContent = header;

      const indicator = document.createElement("span");
      indicator.className = "sort-indicator";
      indicator.setAttribute("aria-hidden", "true");
      indicator.textContent = "↕";

      button.append(label, indicator);
      button.addEventListener("click", () => {
        if (this.state.sortIndex === index) {
          this.state.sortDirection = this.state.sortDirection === "asc" ? "desc" : "asc";
        } else {
          this.state.sortIndex = index;
          this.state.sortDirection = "asc";
        }

        this.state.page = 1;
        this.sortEntries();
        this.render();
      });

      th.append(button);
      row.append(th);
      this.headerButtons.push({ th, button, indicator, header });
    });

    this.elements.head.replaceChildren(row);
    this.updateHeaderState();
  }

  updateHeaderState() {
    this.headerButtons.forEach(({ th, button, indicator, header }, index) => {
      const isActive = this.state.sortIndex === index;
      const direction = isActive ? this.state.sortDirection : null;

      th.setAttribute(
        "aria-sort",
        direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none",
      );
      indicator.textContent = direction === "asc" ? "↑" : direction === "desc" ? "↓" : "↕";

      const action = !isActive
        ? "Urutkan naik"
        : direction === "asc"
          ? "Urutkan turun"
          : "Urutkan naik";
      button.setAttribute("aria-label", `${action}: ${header}`);
    });
  }

  pageCount() {
    return Math.max(1, Math.ceil(this.filteredEntries.length / this.state.pageSize));
  }

  clampPage() {
    this.state.page = Math.min(Math.max(1, this.state.page), this.pageCount());
  }

  render() {
    if (!this.dataset) {
      return;
    }

    this.clampPage();
    this.updateHeaderState();
    this.elements.body.replaceChildren();

    const start = (this.state.page - 1) * this.state.pageSize;
    const pageEntries = this.filteredEntries.slice(start, start + this.state.pageSize);

    if (pageEntries.length === 0) {
      const row = document.createElement("tr");
      row.className = "empty-row";
      const cell = document.createElement("td");
      cell.colSpan = this.dataset.headers.length;
      cell.textContent =
        this.query === ""
          ? "Dataset ini tidak memiliki baris data."
          : `Tidak ada baris yang cocok dengan “${this.query}”.`;
      row.append(cell);
      this.elements.body.append(row);
    } else {
      const fragment = document.createDocumentFragment();

      for (const entry of pageEntries) {
        const row = document.createElement("tr");
        row.dataset.sourceIndex = String(entry.index);

        entry.row.forEach((value) => {
          const cell = document.createElement("td");
          const text = String(value ?? "");

          if (text.trim() === "") {
            cell.textContent = "—";
            cell.className = "cell-empty";
            cell.setAttribute("aria-label", "Kosong");
          } else {
            cell.textContent = text;
            if (text.length > 80 || text.includes("\n")) {
              cell.title = text;
            }
          }

          row.append(cell);
        });

        fragment.append(row);
      }

      this.elements.body.append(fragment);
    }

    const total = this.dataset.rows.length;
    const count = this.filteredEntries.length;
    const end = Math.min(start + this.state.pageSize, count);
    const showingStart = count === 0 ? 0 : start + 1;

    if (count === 0) {
      this.elements.resultCount.textContent =
        this.query === ""
          ? `0 baris dari ${total.toLocaleString("id-ID")} baris.`
          : `0 hasil untuk “${this.query}” dari ${total.toLocaleString("id-ID")} baris.`;
    } else if (this.query !== "") {
      this.elements.resultCount.textContent = `Menampilkan ${showingStart.toLocaleString(
        "id-ID",
      )}–${end.toLocaleString("id-ID")} dari ${count.toLocaleString(
        "id-ID",
      )} hasil (difilter dari ${total.toLocaleString("id-ID")} baris).`;
    } else {
      this.elements.resultCount.textContent = `Menampilkan ${showingStart.toLocaleString(
        "id-ID",
      )}–${end.toLocaleString("id-ID")} dari ${count.toLocaleString("id-ID")} baris.`;
    }

    this.elements.pageInfo.textContent = `Halaman ${this.state.page} dari ${this.pageCount()}`;
    this.elements.prev.disabled = this.state.page <= 1;
    this.elements.next.disabled = this.state.page >= this.pageCount();

    this.emitState();
  }

  clearSearchTimer() {
    if (this.searchTimer !== null) {
      window.clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  }

  flushSearch() {
    if (this.searchTimer === null || !this.dataset) {
      return;
    }

    this.clearSearchTimer();
    this.applyQuery(this.elements.search.value);
  }

  getFilteredRows() {
    return this.filteredEntries.map((entry) => entry.row);
  }

  getExportState() {
    const total = this.dataset?.rows.length ?? 0;
    const count = this.filteredEntries.length;

    return {
      rows: this.getFilteredRows(),
      count,
      total,
      isFiltered: this.query !== "",
      query: this.query,
    };
  }

  emitState() {
    if (typeof this.onStateChange === "function") {
      this.onStateChange(this.getExportState());
    }
  }
}
