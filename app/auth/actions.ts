"use server"

import { z } from "zod"
import { getPrisma } from "@/lib/prisma"
import { hashPassword } from "@/lib/auth"
import { UserRole } from "@/lib/generated/prisma"

const registerSchema = z.object({
  name: z.string().min(2, "Meno musí mať aspoň 2 znaky."),
  email: z.string().email("Zadajte platný e-mail.").toLowerCase(),
  password: z.string().min(6, "Heslo musí mať aspoň 6 znakov."),
})

export type RegisterState = {
  success?: boolean
  error?: string | null
  fields?: {
    name?: string
    email?: string
    password?: string
  }
}

export async function registerUser(prevState: RegisterState, formData: FormData): Promise<RegisterState> {
  const rawData = {
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  }

  const validatedFields = registerSchema.safeParse(rawData)

  if (!validatedFields.success) {
    return {
      error: "Skontrolujte zadané údaje.",
    }
  }

  const { name, email, password } = validatedFields.data
  const prisma = getPrisma()

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return {
        error: "Používateľ s týmto e-mailom už existuje.",
      }
    }

    const passwordHash = await hashPassword(password)

    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: UserRole.USER,
      },
    })

    return { success: true }
  } catch (error) {
    console.error("Registration error:", error)
    return {
      error: "Nastala chyba pri registrácii. Skúste to prosím neskôr.",
    }
  }
}
