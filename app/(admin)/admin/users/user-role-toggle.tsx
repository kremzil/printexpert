"use client"

import { useState, useTransition } from "react"
import { UserRole } from "@/lib/generated/prisma"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateUserRole } from "./actions"
import { useRouter } from "next/navigation"
import { ShieldAlert, User } from "lucide-react"

interface UserRoleToggleProps {
  userId: string
  currentRole: UserRole
  isSelf?: boolean
}

export function UserRoleToggle({ userId, currentRole, isSelf = false }: UserRoleToggleProps) {
  const [isPending, startTransition] = useTransition()
  const [role, setRole] = useState(currentRole)
  const router = useRouter()

  const handleRoleChange = (newRole: UserRole) => {
    if (isSelf) return
    if (newRole === role) return
    const confirmed = window.confirm(
      `Naozaj chcete zmeniť rolu používateľa na ${newRole}?`
    )
    if (!confirmed) return

    startTransition(async () => {
      setRole(newRole)
      try {
        await updateUserRole(userId, newRole)
        router.refresh()
      } catch (error) {
        console.error("Chyba pri zmene role:", error)
        setRole(currentRole) // Rollback
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      {isSelf ? (
        <span className="text-xs text-muted-foreground">Aktuálny používateľ</span>
      ) : null}
      <Select
        value={role}
        onValueChange={(value) => handleRoleChange(value as UserRole)}
        disabled={isPending || isSelf}
      >
        <SelectTrigger className="w-35">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UserRole.USER}>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span>USER</span>
            </div>
          </SelectItem>
          <SelectItem value={UserRole.ADMIN}>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              <span>ADMIN</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
