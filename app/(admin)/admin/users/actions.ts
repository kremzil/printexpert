"use server"

import { requireAdmin } from "@/lib/auth-helpers"
import { getPrisma } from "@/lib/prisma"
import { UserRole } from "@/lib/generated/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { hashPassword } from "@/lib/auth"
import { z } from "zod"

const createUserSchema = z.object({
  name: z.string().trim().min(2, "Meno musí mať aspoň 2 znaky.").max(120),
  email: z.string().trim().email("Neplatný e-mail.").transform((value) => value.toLowerCase()),
  password: z.string().min(6, "Heslo musí mať aspoň 6 znakov."),
  role: z.nativeEnum(UserRole),
})

type DeleteUserInput = {
  userId: string
}

export async function createUserByAdmin(formData: FormData) {
  await requireAdmin()

  const parsed = createUserSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    role: String(formData.get("role") ?? UserRole.USER),
  })

  if (!parsed.success) {
    redirect("/admin/users?createError=invalid")
  }

  const prisma = getPrisma()
  const { name, email, password, role } = parsed.data

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })

  if (existing) {
    redirect("/admin/users?createError=exists")
  }

  const passwordHash = await hashPassword(password)

  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      passwordMigrated: true,
      role,
    },
  })

  revalidatePath("/admin/users")
  redirect("/admin/users?created=1")
}

export async function updateUserRole(userId: string, role: UserRole) {
  const session = await requireAdmin()
  if (session.user.id === userId) {
    throw new Error("Nemôžete meniť vlastnú rolu.")
  }

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

export async function deleteUserByAdmin(input: DeleteUserInput) {
  const session = await requireAdmin()
  if (session.user.id === input.userId) {
    redirect("/admin/users?deleteError=self")
  }

  const prisma = getPrisma()
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, role: true },
  })

  if (!user) {
    redirect("/admin/users?deleteError=notfound")
  }

  if (user.role === UserRole.ADMIN) {
    const adminCount = await prisma.user.count({
      where: { role: UserRole.ADMIN },
    })
    if (adminCount <= 1) {
      redirect("/admin/users?deleteError=lastAdmin")
    }
  }

  try {
    await prisma.user.delete({
      where: { id: user.id },
    })
  } catch (error) {
    console.error("Delete user error:", error)
    redirect("/admin/users?deleteError=related")
  }

  revalidatePath("/admin/users")
  redirect("/admin/users?deleted=1")
}
