import { AuthForms } from "@/app/(site)/(content)/auth/auth-forms"

export default function AuthPage() {
  return (
    <div className="flex min-h-[calc(100vh-140px)] w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-[400px] flex flex-col gap-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Vitajte späť</h1>
          <p className="text-sm text-muted-foreground">
            Prihláste sa do svojho účtu pre správu objednávok
          </p>
        </div>
        
        <AuthForms />
        
        <p className="px-8 text-center text-xs text-muted-foreground">
            Ak ste ešte nenastavili heslo, použite <span className="font-medium text-foreground">Magic Link</span> a nastavte si ho v profile.
        </p>
      </div>
    </div>
  )
}
