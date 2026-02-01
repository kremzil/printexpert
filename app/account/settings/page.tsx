import { Suspense } from "react"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { getPrisma } from "@/lib/prisma"
import { resolveAudienceContext } from "@/lib/audience-context"
import { ProfileSection } from "@/components/account/profile-section"

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
  
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
  })

  if (!user) {
    redirect("/auth")
  }

  const { firstName, lastName } = splitFullName(user.name)

  const handleSaveProfile = async (data: any) => {
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
          companyName: "",
          ico: "",
          dic: "",
          icDph: "",
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
