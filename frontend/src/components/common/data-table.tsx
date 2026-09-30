"use client"

import {
  type ColumnDef,
  FlexRender,
  type SortingState,
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  columnFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import {
  ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Columns3, Download, Rows3, Rows4, Search, X,
} from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { EmptyState } from "./states"

// The features every list in the app uses: sorting, search, pagination and
// column visibility. Pages type their columns with `TableColumn<Row>`.
export const tableFeaturesSet = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  rowPaginationFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic, datetime: sortFn_datetime, text: sortFn_text },
  filterFns: { includesString: filterFn_includesString },
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TableColumn<T extends Record<string, any>> = ColumnDef<typeof tableFeaturesSet, T, any>

/** An active filter shown as a removable chip above the table. */
export interface ActiveFilter {
  label: string
  onClear: () => void
}

type Density = "comfortable" | "compact"
const DENSITY_KEY = "erp.table-density"

function readDensity(): Density {
  try {
    return localStorage.getItem(DENSITY_KEY) === "compact" ? "compact" : "comfortable"
  } catch {
    return "comfortable"
  }
}

function csvCell(value: unknown): string {
  const text = value instanceof Date ? (Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10)) : String(value ?? "")
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface DataTableProps<T extends Record<string, any>> {
  columns: TableColumn<T>[]
  data: T[]
  /** Placeholder for the free-text search box; omit to hide it. */
  searchPlaceholder?: string
  /** Extra filter controls shown next to the search box. */
  toolbar?: React.ReactNode
  /** Filters currently applied by the toolbar, shown as chips with "Clear all". */
  filters?: ActiveFilter[]
  /** File name (without date) for "Export CSV"; omit to hide the button. */
  exportName?: string
  emptyTitle?: string
  emptyDescription?: string
  initialSorting?: SortingState
  pageSize?: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  searchPlaceholder,
  toolbar,
  filters = [],
  exportName,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  initialSorting = [],
  pageSize = 20,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const [globalFilter, setGlobalFilter] = useState("")
  const [density, setDensity] = useState<Density>(readDensity)

  const table = useTable({
    features: tableFeaturesSet,
    columns,
    data,
    globalFilterFn: "includesString",
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    initialState: { pagination: { pageIndex: 0, pageSize } },
  })

  const rows = table.getRowModel().rows
  const total = table.getFilteredRowModel().rows.length
  const { pageIndex, pageSize: size } = table.state.pagination
  const hideable = table.getAllLeafColumns().filter((c) => c.getCanHide())
  const label = (id: string, header: unknown) => (typeof header === "string" && header ? header : id)
  // Figures (sorted numerically) line up on the right
  const numeric = (sortFn: unknown) => sortFn === "basic"

  const setSearch = (value: string) => {
    setGlobalFilter(value)
    table.setPageIndex(0)
  }

  const toggleDensity = () => {
    const next: Density = density === "comfortable" ? "compact" : "comfortable"
    setDensity(next)
    try {
      localStorage.setItem(DENSITY_KEY, next)
    } catch {
      // storage unavailable (private mode): keep the choice for this page only
    }
  }

  const exportCsv = () => {
    const cols = table.getVisibleLeafColumns().filter((c) => c.id !== "actions")
    const lines = [
      cols.map((c) => csvCell(label(c.id, c.columnDef.header))).join(","),
      ...table.getFilteredRowModel().rows.map((row) => cols.map((c) => csvCell(row.getValue(c.id))).join(",")),
    ]
    const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `${exportName}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const cellHeight = density === "compact" ? "h-10" : "h-13"
  const searching = globalFilter.trim() !== ""

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {searchPlaceholder && (
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={globalFilter}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setSearch("")}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-9 pr-8 pl-9"
            />
            {globalFilter && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        )}
        {toolbar}
        <div className="ml-auto flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" className="size-9" onClick={toggleDensity}
                aria-label={density === "compact" ? "Comfortable rows" : "Compact rows"}>
                {density === "compact" ? <Rows3 className="size-4" /> : <Rows4 className="size-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{density === "compact" ? "Comfortable rows" : "Compact rows"}</TooltipContent>
          </Tooltip>
          {hideable.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-9">
                  <Columns3 className="size-4" /> Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {hideable.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(v) => column.toggleVisibility(!!v)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {label(column.id, column.columnDef.header)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {exportName && (
            <Button variant="outline" className="h-9" onClick={exportCsv} disabled={!total}>
              <Download className="size-4" /> Export
            </Button>
          )}
        </div>
      </div>

      {(filters.length > 0 || searching) && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {searching && (
            <FilterChip label={`Search: “${globalFilter.trim()}”`} onClear={() => setSearch("")} />
          )}
          {filters.map((f) => <FilterChip key={f.label} label={f.label} onClear={f.onClear} />)}
          <button
            type="button"
            className="rounded px-1 font-medium text-brand-text hover:underline"
            onClick={() => {
              setSearch("")
              filters.forEach((f) => f.onClear())
            }}
          >
            Clear all
          </button>
        </div>
      )}

      <div className="surface overflow-hidden rounded-xl">
        <Table containerClassName="max-h-[min(72vh,760px)] overflow-auto">
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header, i) => {
                  const sorted = header.column.getIsSorted()
                  const right = numeric(header.column.columnDef.sortFn)
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                      className={cn(
                        "sticky top-0 z-10 bg-[color-mix(in_oklab,var(--card),var(--foreground)_3%)]",
                        i === 0 && "left-0 z-20",
                        right && "text-right",
                      )}
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            "-mx-1 inline-flex items-center gap-1 rounded px-1 transition-colors hover:text-foreground",
                            sorted && "text-foreground",
                            right && "flex-row-reverse",
                          )}
                        >
                          <FlexRender header={header} />
                          {sorted === "asc" ? (
                            <ArrowUp className="size-3.5 text-brand-text" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-3.5 text-brand-text" />
                          ) : (
                            <ArrowUpDown className="size-3.5 opacity-40" />
                          )}
                        </button>
                      ) : (
                        <FlexRender header={header} />
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell, i) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        cellHeight,
                        i === 0 && "sticky left-0 z-[1] bg-card group-hover/row:bg-[color-mix(in_oklab,var(--card),var(--foreground)_3.5%)]",
                        numeric(cell.column.columnDef.sortFn) && "text-right",
                        cell.column.id === "actions" && "w-12 text-right",
                      )}
                    >
                      <FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={table.getVisibleLeafColumns().length} className="border-0">
                  <EmptyState
                    icon={data.length ? Search : undefined}
                    title={data.length ? "No matching records" : emptyTitle}
                    description={data.length ? "Try a different search or filter." : emptyDescription}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-[color-mix(in_oklab,var(--card),var(--foreground)_1.5%)] px-4 py-2.5 text-sm text-muted-foreground">
            <span>
              {pageIndex * size + 1}–{Math.min((pageIndex + 1) * size, total)} of {total}
            </span>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline">Rows per page</span>
              <Select value={String(size)} onValueChange={(v) => table.setPageSize(Number(v))}>
                <SelectTrigger size="sm" className="w-[72px]" aria-label="Rows per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 50, 100].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FilterChip({ label, onClear }: ActiveFilter) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 py-0.5 pr-1 pl-2.5 font-medium text-brand-text">
      {label}
      <button type="button" onClick={onClear} aria-label={`Remove filter ${label}`}
        className="flex size-4 items-center justify-center rounded-full hover:bg-brand/20">
        <X className="size-3" />
      </button>
    </span>
  )
}
