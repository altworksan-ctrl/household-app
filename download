export const TAPES = [
  { id: "mustard", hex: "#D6A419" },
  { id: "rust", hex: "#BD4C2E" },
  { id: "moss", hex: "#4B6B4E" },
  { id: "denim", hex: "#3E5C76" },
  { id: "clay", hex: "#C97B63" },
  { id: "plum", hex: "#6B4C6B" },
  { id: "teal", hex: "#2F6E6A" },
];

export const CURRENCY = "£";

export const pad = (n) => String(n).padStart(2, "0");
export const monthKeyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const dateKeyOf = (d) => `${monthKeyOf(d)}-${pad(d.getDate())}`;
export const daysInMonth = (monthKey) => {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m, 0).getDate();
};
export const monthLabel = (monthKey) => {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
};
export const weekdayShort = (dateKey) => {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short" });
};
export const money = (n) => `${CURRENCY}${(Math.round(n * 100) / 100).toFixed(2)}`;
export const shiftMonth = (monthKey, delta) => {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKeyOf(d);
};
export const monthRange = (monthKey) => {
  const [y, m] = monthKey.split("-").map(Number);
  const start = `${monthKey}-01`;
  const nextMonth = new Date(y, m, 1); // first day of next month
  const end = `${nextMonth.getFullYear()}-${pad(nextMonth.getMonth() + 1)}-01`;
  return { start, end };
};

export function tapeHex(member) {
  return TAPES[(member?.tape_index ?? 0) % TAPES.length].hex;
}

export function generateMonthEntries(monthKey, activeMembers) {
  const n = activeMembers.length;
  const days = daysInMonth(monthKey);
  const entries = [];
  for (let d = 1; d <= days; d++) {
    const idx = d - 1;
    const cookId = n > 0 ? activeMembers[idx % n].id : null;
    const cleanId = n > 0 ? activeMembers[(idx + 1) % n].id : null;
    entries.push({ date: `${monthKey}-${pad(d)}`, cook_id: cookId, clean_id: cleanId });
  }
  return entries;
}

export function computeSettlements(balances) {
  const debtors = balances
    .filter((b) => b.net < -0.01)
    .map((b) => ({ ...b }))
    .sort((a, b) => a.net - b.net);
  const creditors = balances
    .filter((b) => b.net > 0.01)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.net - a.net);
  const res = [];
  let i = 0,
    j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i],
      c = creditors[j];
    const amt = Math.min(-d.net, c.net);
    res.push({ from: d.name, to: c.name, amount: amt });
    d.net += amt;
    c.net -= amt;
    if (Math.abs(d.net) < 0.01) i++;
    if (Math.abs(c.net) < 0.01) j++;
  }
  return res;
}
