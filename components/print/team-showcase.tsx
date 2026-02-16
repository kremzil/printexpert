import { Card } from "@/components/ui/card"
import type { CustomerMode } from "@/components/print/types"
import { Linkedin, Mail, Phone } from "lucide-react"

type TeamMember = {
  id?: string
  name: string
  position?: string
  role?: string
  department?: string
  email?: string
  phone?: string
  image?: string
  linkedin?: string
  specialization?: string
  mode?: "b2c" | "b2b" | "both"
}

interface TeamShowcaseProps {
  mode: CustomerMode
  members: TeamMember[]
}

export function TeamShowcase({ mode, members }: TeamShowcaseProps) {
  const modeColor = mode === "b2c" ? "var(--b2c-primary)" : "var(--b2b-primary)"

  const filteredMembers = members.filter(
    (member) => !member.mode || member.mode === mode || member.mode === "both"
  )

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {filteredMembers.map((member) => {
        const initials = member.name
          .split(" ")
          .map((part) => part[0])
          .join("")
          .toUpperCase()

        const position = member.position ?? member.role ?? ""

        return (
          <Card
            key={member.id ?? member.name}
            className="overflow-hidden transition-all hover:shadow-lg"
          >
            <div className="relative">
              <div
                className="flex h-64 items-center justify-center text-4xl font-bold text-white"
                style={{
                  background: member.image
                    ? `url(${member.image}) top/cover`
                    : `linear-gradient(135deg, ${modeColor} 0%, ${modeColor}aa 100%)`,
                }}
              >
                {!member.image && initials}
              </div>
              {member.department ? (
                <div
                  className="absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-semibold text-white"
                  style={{ backgroundColor: modeColor }}
                >
                  {member.department}
                </div>
              ) : null}
            </div>

            <div className="p-6">
              <h3 className="mb-1 text-lg font-bold">{member.name}</h3>
              {position ? (
                <p className="mb-3 text-sm font-medium" style={{ color: modeColor }}>
                  {position}
                </p>
              ) : null}

              {member.specialization ? (
                <p className="mb-4 text-sm text-muted-foreground">
                  {member.specialization}
                </p>
              ) : null}

              <div className="space-y-2">
                {member.email ? (
                  <a
                    href={`mailto:${member.email}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{member.email}</span>
                  </a>
                ) : null}
                {member.phone ? (
                  <a
                    href={`tel:${member.phone}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Phone className="h-4 w-4" />
                    <span>{member.phone}</span>
                  </a>
                ) : null}
                {member.linkedin ? (
                  <a
                    href={member.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm transition-colors hover:text-foreground"
                    style={{ color: modeColor }}
                  >
                    <Linkedin className="h-4 w-4" />
                    <span>LinkedIn profil</span>
                  </a>
                ) : null}
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
