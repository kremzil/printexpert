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

const updateUserSchema = z.object({
  userId: z.string().trim().min(1),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  role: z.nativeEnum(UserRole),
  image: z.string().trim().max(500).optional(),
  stripeCustomerId: z.string().trim().max(255).optional(),
  emailVerified: z.enum(["1", "0"]).default("0"),
  passwordMigrated: z.enum(["1", "0"]).default("1"),
  newPassword: z.string().optional(),
  companyName: z.string().trim().max(255).optional(),
  ico: z.string().trim().max(50).optional(),
  dic: z.string().trim().max(50).optional(),
  icDph: z.string().trim().max(50).optional(),
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

export async function updateUserByAdmin(formData: FormData) {
  const session = await requireAdmin()
  const parsed = updateUserSchema.safeParse({
    userId: String(formData.get("userId") ?? ""),
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    role: String(formData.get("role") ?? UserRole.USER),
    image: String(formData.get("image") ?? ""),
    stripeCustomerId: String(formData.get("stripeCustomerId") ?? ""),
    emailVerified: String(formData.get("emailVerified") ?? "0"),
    passwordMigrated: String(formData.get("passwordMigrated") ?? "0"),
    newPassword: String(formData.get("newPassword") ?? ""),
    companyName: String(formData.get("companyName") ?? ""),
    ico: String(formData.get("ico") ?? ""),
    dic: String(formData.get("dic") ?? ""),
    icDph: String(formData.get("icDph") ?? ""),
  })

  const fallbackUserId = String(formData.get("userId") ?? "")

  if (!parsed.success) {
    redirect(`/admin/users/${fallbackUserId}?editError=invalid`)
  }

  const prisma = getPrisma()
  const {
    userId,
    name,
    email,
    role,
    image,
    stripeCustomerId,
    emailVerified,
    passwordMigrated,
    newPassword,
    companyName,
    ico,
    dic,
    icDph,
  } = parsed.data

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      emailVerified: true,
    },
  })

  if (!user) {
    redirect("/admin/users?deleteError=notfound")
  }

  if (session.user.id === userId && role !== user.role) {
    redirect(`/admin/users/${userId}?editError=selfRole`)
  }

  if (user.role === UserRole.ADMIN && role === UserRole.USER) {
    const adminCount = await prisma.user.count({
      where: { role: UserRole.ADMIN },
    })

    if (adminCount <= 1) {
      redirect(`/admin/users/${userId}?editError=lastAdmin`)
    }
  }

  const existingWithEmail = await prisma.user.findFirst({
    where: {
      email,
      id: { not: userId },
    },
    select: { id: true },
  })

  if (existingWithEmail) {
    redirect(`/admin/users/${userId}?editError=exists`)
  }

  const normalize = (value?: string | null) => {
    const trimmed = (value ?? "").trim()
    return trimmed.length > 0 ? trimmed : null
  }

  const normalizedImage = normalize(image)
  const normalizedStripeCustomerId = normalize(stripeCustomerId)
  const normalizedCompanyName = normalize(companyName)
  const normalizedIco = normalize(ico)
  const normalizedDic = normalize(dic)
  const normalizedIcDph = normalize(icDph)
  const normalizedNewPassword = (newPassword ?? "").trim()

  const shouldStoreCompanyProfile = Boolean(
    normalizedCompanyName || normalizedIco || normalizedDic || normalizedIcDph
  )

  if (shouldStoreCompanyProfile && !normalizedCompanyName) {
    redirect(`/admin/users/${userId}?editError=companyNameRequired`)
  }

  const nextPasswordMigrated =
    normalizedNewPassword.length > 0 ? true : passwordMigrated === "1"
  const nextEmailVerified =
    emailVerified === "1"
      ? user.emailVerified ?? new Date()
      : null

  const updateData: {
    name: string
    email: string
    role: UserRole
    image: string | null
    stripeCustomerId: string | null
    emailVerified: Date | null
    passwordMigrated: boolean
    passwordHash?: string
  } = {
    name,
    email,
    role,
    image: normalizedImage,
    stripeCustomerId: normalizedStripeCustomerId,
    emailVerified: nextEmailVerified,
    passwordMigrated: nextPasswordMigrated,
  }

  if (normalizedNewPassword.length > 0) {
    if (normalizedNewPassword.length < 6) {
      redirect(`/admin/users/${userId}?editError=password`)
    }
    updateData.passwordHash = await hashPassword(normalizedNewPassword)
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: updateData,
      })

      if (shouldStoreCompanyProfile) {
        await tx.companyProfile.upsert({
          where: { userId },
          create: {
            userId,
            companyName: normalizedCompanyName!,
            ico: normalizedIco,
            dic: normalizedDic,
            icDph: normalizedIcDph,
          },
          update: {
            companyName: normalizedCompanyName!,
            ico: normalizedIco,
            dic: normalizedDic,
            icDph: normalizedIcDph,
          },
        })
      } else {
        await tx.companyProfile.deleteMany({
          where: { userId },
        })
      }
    })
  } catch (error) {
    console.error("Update user error:", error)
    redirect(`/admin/users/${userId}?editError=unknown`)
  }

  revalidatePath("/admin/users")
  revalidatePath(`/admin/users/${userId}`)
  redirect(`/admin/users/${userId}?updated=1`)
}
