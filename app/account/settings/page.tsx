import { Suspense } from "react"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { getPrisma } from "@/lib/prisma"
import { resolveAudienceContext } from "@/lib/audience-context"
import { ProfileSection, type ProfileData } from "@/components/account/profile-section"

function splitFullName(fullName: string | null | undefined) {
  const normalized = (fullName ?? "").trim()
  if (!normalized) {
    return { firstName: "", lastName: "" }
  }
  const parts = normalized.split(/\s+/)
  const [firstName, ...rest] = parts
  return { firstName, lastName: rest.join(" ") }
}

async function ProfileContent() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/auth")
  }

  const prisma = getPrisma()
  const audienceContext = await resolveAudienceContext()
  
  const [user, companyProfile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    }),
    prisma.companyProfile.findUnique({
      where: { userId: session.user.id },
    }),
  ])

  if (!user) {
    redirect("/auth")
  }

  const { firstName, lastName } = splitFullName(user.name)

  const isB2b = audienceContext.mode === "b2b"

  const handleSaveProfile = async (data: ProfileData) => {
    "use server"
    const prisma = getPrisma()
    const session = await auth()
    
    if (!session?.user?.id) {
      throw new Error("Neautorizovaný")
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: `${data.firstName} ${data.lastName}`.trim(),
        email: data.email,
      },
    })

    const normalize = (value?: string | null) => {
      const trimmed = (value ?? "").trim()
      return trimmed ? trimmed : null
    }

    if (isB2b) {
      const normalizedCompanyName = normalize(data.companyName)
      if (!normalizedCompanyName) {
        throw new Error("Názov spoločnosti je povinný.")
      }

      await prisma.companyProfile.upsert({
        where: { userId: session.user.id },
        create: {
          userId: session.user.id,
          companyName: normalizedCompanyName,
          ico: normalize(data.ico),
          dic: normalize(data.dic),
          icDph: normalize(data.icDph),
        },
        update: {
          companyName: normalizedCompanyName,
          ico: normalize(data.ico),
          dic: normalize(data.dic),
          icDph: normalize(data.icDph),
        },
      })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Profil</h1>
        <p className="text-muted-foreground">
          Spravujte svoje osobné údaje a nastavenia
        </p>
      </div>

      <ProfileSection
        mode={audienceContext.mode}
        initialData={{
          firstName,
          lastName,
          email: user.email || "",
          phone: "",
          companyName: companyProfile?.companyName ?? "",
          ico: companyProfile?.ico ?? "",
          dic: companyProfile?.dic ?? "",
          icDph: companyProfile?.icDph ?? "",
          position: "",
        }}
        onSave={handleSaveProfile}
      />
    </div>
  )
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-xl border bg-muted/30 p-6 text-sm text-muted-foreground">
          Načítavam profil…
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  )
}
