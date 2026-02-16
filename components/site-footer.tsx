import Link from "next/link"
import Image from "next/image"
import { Suspense } from "react"

import { getCategories } from "@/lib/catalog"
import { buildCategoryTree } from "@/lib/category-tree"
import { AudienceFooterNote } from "@/components/audience-footer-note"
import { AudienceModeSwitch } from "@/components/audience-mode-switch"
import { resolveAudienceContext } from "@/lib/audience-context"

async function AudienceFooterSwitch() {
  const audienceContext = await resolveAudienceContext()
  if (audienceContext.source === "default") {
    return null
  }
  return <AudienceModeSwitch initialAudience={audienceContext.audience} />
}

async function FooterCategories() {
  const categories = await getCategories()
  const { rootCategories } = buildCategoryTree(categories)

  return (
    <ul className="space-y-2">
      {rootCategories.map((cat) => (
        <li key={cat.id}>
          <Link
            href={`/kategorie?cat=${cat.slug}`}
            className="text-sm text-primary-foreground/85 transition-colors hover:text-primary-foreground/65"
          >
            {cat.name}
          </Link>
        </li>
      ))}
    </ul>
  )
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
    </svg>
  )
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  )
}

function VisaIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 32"
      className={className}
      fill="none"
    >
      <rect width="48" height="32" rx="4" fill="#fff" />
      <path
        d="M19.616 21.12h-2.88l1.8-11.04h2.88l-1.8 11.04zm12.24-10.752a7.13 7.13 0 00-2.568-.468c-2.832 0-4.824 1.5-4.836 3.648-.024 1.584 1.416 2.472 2.496 3 1.104.54 1.476.888 1.476 1.368-.012.744-.888 1.08-1.704 1.08-1.14 0-1.74-.168-2.676-.576l-.372-.18-.396 2.448c.66.3 1.884.564 3.156.576 3.012 0 4.968-1.488 4.992-3.768.012-1.26-.756-2.22-2.4-3.012-1-.512-1.608-.852-1.608-1.38.012-.468.516-.96 1.644-.96a4.92 4.92 0 012.124.42l.252.12.384-2.316zm7.38-.288h-2.208c-.684 0-1.2.192-1.5.912l-4.248 10.128h3.012l.6-1.656h3.672l.348 1.656h2.664l-2.34-11.04zm-3.54 7.128c.24-.636 1.14-3.084 1.14-3.084-.012.024.24-.636.384-1.044l.192.948s.552 2.64.66 3.18h-2.376zM16.16 10.08l-2.808 7.524-.3-1.536c-.528-1.776-2.16-3.708-3.996-4.668l2.568 9.708h3.036l4.512-11.028h-3.012z"
        fill="#1A1F71"
      />
      <path
        d="M10.544 10.08H5.888l-.048.288c3.6.912 5.988 3.12 6.972 5.772l-1.008-5.1c-.168-.708-.684-.936-1.26-.96z"
        fill="#F9A533"
      />
    </svg>
  )
}

function MastercardIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 32"
      className={className}
      fill="none"
    >
      <rect width="48" height="32" rx="4" fill="#fff" />
      <circle cx="19" cy="16" r="9" fill="#EB001B" />
      <circle cx="29" cy="16" r="9" fill="#F79E1B" />
      <path
        d="M24 9.343A8.97 8.97 0 0128 16a8.97 8.97 0 01-4 6.657A8.97 8.97 0 0120 16a8.97 8.97 0 014-6.657z"
        fill="#FF5F00"
      />
    </svg>
  )
}

function StripeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 32"
      className={className}
      fill="none"
    >
      <rect width="48" height="32" rx="4" fill="#635BFF" />
      <path
        d="M22.2 13.42c0-.81.67-1.12 1.77-1.12 1.58 0 3.58.48 5.16 1.33V9.05a13.65 13.65 0 00-5.16-.95c-4.22 0-7.02 2.2-7.02 5.89 0 5.74 7.9 4.83 7.9 7.3 0 .96-.84 1.27-2.01 1.27-1.74 0-3.96-.71-5.72-1.68v4.65a14.54 14.54 0 005.72 1.22c4.32 0 7.29-2.14 7.29-5.87-.01-6.2-7.93-5.1-7.93-7.46z"
        fill="#fff"
      />
    </svg>
  )
}

function CashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 32"
      className={className}
      fill="none"
    >
      <rect width="48" height="32" rx="4" fill="#22C55E" />
      <rect x="6" y="9" width="36" height="14" rx="2" stroke="#fff" strokeWidth="1.5" fill="none" />
      <circle cx="24" cy="16" r="4" stroke="#fff" strokeWidth="1.5" fill="none" />
      <text
        x="24"
        y="18"
        textAnchor="middle"
        fill="#fff"
        fontSize="7"
        fontWeight="bold"
        fontFamily="system-ui, sans-serif"
      >
        €
      </text>
    </svg>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t bg-[var(--bg-grid-foreground)] text-[var(--muted)]">
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
        {/* Main footer grid */}
        <div className="grid grid-cols-1 gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="inline-block">
              <Image
                src="/printexpert-logo.png"
                alt="PrintExpert"
                width={160}
                height={36}
                className="h-9 w-auto"
              />
            </Link>
            <p className="text-sm leading-relaxed text-primary-foreground/90">
              Profesionálna tlač a potlač pre firmy aj jednotlivcov. Kvalita, rýchlosť a férové ceny.
            </p>
            {/* Social icons */}
            <div className="flex items-center gap-3 pt-1">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/10 transition-colors hover:bg-primary-foreground/20"
              >
                <FacebookIcon className="h-4 w-4" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/10 transition-colors hover:bg-primary-foreground/20"
              >
                <InstagramIcon className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Categories */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-primary-foreground/90">
              Kategórie
            </h3>
            <Suspense
              fallback={
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-4 w-24 animate-pulse rounded bg-primary-foreground/50"
                    />
                  ))}
                </div>
              }
            >
              <FooterCategories />
            </Suspense>
          </div>

          {/* Info pages */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-primary-foreground/85">
              Informácie
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/doprava"
                  className="text-sm text-primary-foreground/85 transition-colors hover:text-primary-foreground/65"
                >
                  Doprava
                </Link>
              </li>
              <li>
                <Link
                  href="/obchodne-podmienky"
                  className="text-sm text-primary-foreground/85 transition-colors hover:text-primary-foreground/65"
                >
                  Obchodné podmienky
                </Link>
              </li>
              <li>
                <Link
                  href="/ochrana-osobnych-udajov"
                  className="text-sm text-primary-foreground/85 transition-colors hover:text-primary-foreground/65"
                >
                  Ochrana osobných údajov
                </Link>
              </li>
              <li>
                <Link
                  href="/vratenie-tovaru"
                  className="text-sm text-primary-foreground/85 transition-colors hover:text-primary-foreground/65"
                >
                  Vrátenie tovaru
                </Link>
              </li>
              <li>
                <Link
                  href="/kontaktujte-nas"
                  className="text-sm text-primary-foreground/85 transition-colors hover:text-primary-foreground/65"
                >
                  Kontaktujte nás
                </Link>
              </li>
            </ul>
          </div>

          {/* Payment methods */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-primary-foreground/85">
              Akceptujeme platby
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <VisaIcon className="h-8 w-12 rounded" />
              <MastercardIcon className="h-8 w-12 rounded" />
              <StripeIcon className="h-8 w-12 rounded" />
              <CashIcon className="h-8 w-12 rounded" />
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-primary-foreground/10 py-6 sm:flex-row">
          <span className="text-sm text-primary-foreground/50">
            © {new Date().getFullYear()} PrintExpert. Všetky práva vyhradené.
          </span>
          <div className="flex items-center gap-4">
            <Suspense fallback={null}>
              <AudienceFooterNote />
            </Suspense>
            <Suspense fallback={null}>
              <AudienceFooterSwitch />
            </Suspense>
          </div>
        </div>
      </div>
    </footer>
  )
}
