"use client"

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
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
