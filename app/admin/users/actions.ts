"use server"

import { requireAdmin } from "@/lib/auth-helpers"
import { getPrisma } from "@/lib/prisma"
import { UserRole } from "@/lib/generated/prisma"
import { revalidatePath } from "next/cache"

export async function updateUserRole(userId: string, role: UserRole) {
  await requireAdmin()

  const prisma = getPrisma()

  // Нельзя удалить последнего админа
  if (role === UserRole.USER) {
    const adminCount = await prisma.user.count({
      where: { role: UserRole.ADMIN },
    })

    if (adminCount <= 1) {
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      })

      if (currentUser?.role === UserRole.ADMIN) {
        throw new Error("Nemožno odobrať práva poslednému administrátorovi")
      }
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role },
  })

  revalidatePath("/admin/users")
}
