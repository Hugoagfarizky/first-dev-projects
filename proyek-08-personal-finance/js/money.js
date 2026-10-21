export const MAX_AMOUNT = 999_999_999_999;

export const CURRENCY_FORMATTER = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function formatCurrency(amount) {
  const value = Number.isSafeInteger(amount) ? amount : 0;
  return CURRENCY_FORMATTER.format(value);
}

export function formatSignedCurrency(amount) {
  if (!Number.isSafeInteger(amount) || amount === 0) return formatCurrency(0);
  return `${amount > 0 ? "+" : "−"}${formatCurrency(Math.abs(amount))}`;
}

export function formatAmountForInput(amount) {
  if (!Number.isSafeInteger(amount) || amount <= 0) return "";
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(amount);
}

/**
 * Parse an integer-rupiah input. Indonesian thousands separators (dots) are
 * accepted, but decimals and fractional values are rejected.
 */
export function parseAmount(input) {
  if (typeof input === "number") {
    if (!Number.isSafeInteger(input) || input <= 0) {
      return {
        ok: false,
        value: null,
        error:
          input === 0
            ? "Nominal harus lebih besar dari nol."
            : "Nominal harus berupa bilangan bulat positif.",
      };
    }
    if (input > MAX_AMOUNT) {
      return {
        ok: false,
        value: null,
        error: "Nominal melebihi batas yang didukung.",
      };
    }
    return { ok: true, value: input, error: "" };
  }

  if (typeof input !== "string") {
    return { ok: false, value: null, error: "Nominal wajib diisi." };
  }

  let text = input.trim();
  if (!text) {
    return { ok: false, value: null, error: "Nominal wajib diisi." };
  }

  text = text.replace(/^rp\.?\s*/i, "").replace(/\s+/g, "");
  if (!text) {
    return { ok: false, value: null, error: "Nominal wajib diisi." };
  }

  if (text.includes(",")) {
    return {
      ok: false,
      value: null,
      error: "Gunakan bilangan bulat rupiah tanpa desimal.",
    };
  }

  if (/^\d+$/.test(text)) {
    // Plain digits are valid.
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, "");
  } else {
    return {
      ok: false,
      value: null,
      error: "Gunakan angka bulat, misalnya 250000 atau 250.000.",
    };
  }

  if (text.length > 15) {
    return {
      ok: false,
      value: null,
      error: "Nominal melebihi batas yang didukung.",
    };
  }

  const value = Number(text);
  if (!Number.isSafeInteger(value)) {
    return {
      ok: false,
      value: null,
      error: "Nominal harus berupa bilangan bulat yang valid.",
    };
  }
  if (value <= 0) {
    return {
      ok: false,
      value: null,
      error: "Nominal harus lebih besar dari nol.",
    };
  }
  if (value > MAX_AMOUNT) {
    return {
      ok: false,
      value: null,
      error: `Nominal maksimal ${formatCurrency(MAX_AMOUNT)}.`,
    };
  }

  return { ok: true, value, error: "" };
}

export function isPositiveIntegerAmount(value) {
  return Number.isSafeInteger(value) && value > 0 && value <= MAX_AMOUNT;
}

export function sumAmounts(values) {
  let total = 0;
  for (const value of values) {
    if (!Number.isSafeInteger(value)) continue;
    total += value;
  }
  return total;
}

export function percentOf(part, whole) {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}