"use client"

import { Lock, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import type { User } from "@/lib/types"
import { initials } from "@/lib/format"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ROLE_LABEL } from "./user-dialog"

const SELF_TIP = "ไม่สามารถเปลี่ยนสิทธิ์หรือลบบัญชีของตัวเองได้"

function Who({ u, self }: { u: User; self: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="size-9">
        <AvatarFallback className="bg-indigo-50 dark:bg-indigo-500/10 text-xs font-semibold text-indigo-700 dark:text-indigo-300">{initials(u.full_name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">
          {u.full_name}
          {self && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">คุณ</span>}
        </p>
        <p className="truncate text-sm text-muted-foreground md:hidden">{u.email}</p>
      </div>
    </div>
  )
}

function Actions({ u, self, onEdit, onDelete }: { u: User; self: boolean; onEdit: (u: User) => void; onDelete: (u: User) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`จัดการ ${u.full_name}`}><MoreHorizontal /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onEdit(u)}><Pencil /> แก้ไข</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" disabled={self} onSelect={() => onDelete(u)}>
          <Trash2 /> {self ? "ลบ (บัญชีของคุณ)" : "ลบ"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function UsersTable({
  users, meId, busyId, onEdit, onDelete, onRole,
}: {
  users: User[]
  meId?: number
  busyId: number | null
  onEdit: (u: User) => void
  onDelete: (u: User) => void
  onRole: (u: User, role: User["role"]) => void
}) {
  const roleSelect = (u: User, self: boolean) => {
    const sel = (
      <Select value={u.role} onValueChange={(v) => onRole(u, v as User["role"])} disabled={self || busyId === u.user_id}>
        <SelectTrigger size="sm" className="w-28" aria-label={`สิทธิ์ของ ${u.full_name}`}>
          {self && <Lock className="size-3 text-muted-foreground" />}
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="applicant">{ROLE_LABEL.applicant}</SelectItem>
          <SelectItem value="recruitment">{ROLE_LABEL.recruitment}</SelectItem>
        </SelectContent>
      </Select>
    )
    return self ? (
      <Tooltip>
        <TooltipTrigger asChild><span tabIndex={0} className="inline-block">{sel}</span></TooltipTrigger>
        <TooltipContent>{SELF_TIP}</TooltipContent>
      </Tooltip>
    ) : sel
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <Table className="hidden md:table">
        <TableHeader>
          <TableRow className="bg-muted/70 hover:bg-muted/70">
            <TableHead className="pl-5">ผู้ใช้</TableHead>
            <TableHead>อีเมล</TableHead>
            <TableHead>เบอร์โทร</TableHead>
            <TableHead>สิทธิ์</TableHead>
            <TableHead className="w-12 pr-5" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => {
            const self = u.user_id === meId
            return (
              <TableRow key={u.user_id}>
                <TableCell className="pl-5"><Who u={u} self={self} /></TableCell>
                <TableCell className="text-foreground/70">{u.email}</TableCell>
                <TableCell className="text-foreground/70">{u.phone || "-"}</TableCell>
                <TableCell>{roleSelect(u, self)}</TableCell>
                <TableCell className="pr-5 text-right"><Actions u={u} self={self} onEdit={onEdit} onDelete={onDelete} /></TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <ul className="divide-y md:hidden">
        {users.map((u) => {
          const self = u.user_id === meId
          return (
            <li key={u.user_id} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <Who u={u} self={self} />
                <Actions u={u} self={self} onEdit={onEdit} onDelete={onDelete} />
              </div>
              <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <span>{u.phone || "-"}</span>
                {roleSelect(u, self)}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
