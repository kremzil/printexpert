import { AuthForms } from "@/app/auth/auth-forms"

export default function AuthPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Prihlásenie</h1>
        <p className="text-sm text-muted-foreground">
          Vyberte si spôsob prihlásenia. Magic link funguje aj bez hesla.
        </p>
      </div>
      <AuthForms />
      <p className="text-xs text-muted-foreground">
        Ak ste ešte nenastavili heslo, použite magic link a nastavte si ho v
        kabinete.
      </p>
    </div>
  )
}
