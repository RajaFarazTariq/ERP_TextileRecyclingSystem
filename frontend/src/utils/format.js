// Number formatting shared by the module pages.
export const int   = v => Math.round(Number(v) || 0);
export const fmt   = v => int(v).toLocaleString();
export const fmtRs = v => `Rs. ${fmt(v)}`;
