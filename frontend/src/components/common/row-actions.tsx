"use client"

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { usePageAccess } from "@/features/auth/use-page-access"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface ExtraAction {
  label: string
  icon?: React.ReactNode
  onSelect: () => void
  /** Only shows something (a statement, a print-out): stays available on a view-only page */
  view?: boolean
}

/** The "⋯" menu at the end of a table row: optional extra actions, Edit, Delete. */
export function RowActions({
  onEdit,
  onDelete,
  extra = [],
}: {
  onEdit?: () => void
  onDelete?: () => void
  extra?: ExtraAction[]
}) {
  // On a view-only page the menu keeps only what shows something
  const { readOnly } = usePageAccess()
  if (readOnly) {
    extra = extra.filter((a) => a.view)
    onEdit = onDelete = undefined
    if (!extra.length) return null
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Row actions">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {extra.map((a) => (
          <DropdownMenuItem key={a.label} onSelect={a.onSelect}>
            {a.icon} {a.label}
          </DropdownMenuItem>
        ))}
        {extra.length > 0 && (onEdit || onDelete) && <DropdownMenuSeparator />}
        {onEdit && (
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil className="size-4" /> Edit
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem variant="destructive" onSelect={onDelete}>
            <Trash2 className="size-4" /> Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
