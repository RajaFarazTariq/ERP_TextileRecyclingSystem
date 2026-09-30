// Display formatting shared by all pages.

const number = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 2 })
const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" })

export function kg(value: string | number | null | undefined): string {
  const n = Number(value)
  return Number.isFinite(n) ? `${number.format(n)} kg` : "—"
}

export function rupees(value: string | number | null | undefined): string {
  const n = Number(value)
  return Number.isFinite(n) ? `Rs. ${number.format(Math.round(n))}` : "—"
}

export function date(value: string | null | undefined): string {
  if (!value) return "—"
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? "—" : dateFmt.format(d)
}
