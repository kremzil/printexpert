import Link from "next/link"
import Image from "next/image"
import { RegisterForm } from "../register-form"

export default function RegisterPage() {
  return (
    <div className="flex min-h-[calc(100vh-140px)] w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-[400px] flex flex-col gap-6">
        <div className="flex flex-col items-center text-center space-y-2">
            <div className="rounded-full bg-primary/10 p-3 mb-2">
                <Image 
                    src="/printexpert-logo.svg" 
                    alt="Logo" 
                    width={40} 
                    height={40} 
                    className="h-6 w-auto"
                />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Vytvoriť nový účet</h1>
            <p className="text-sm text-muted-foreground">
                Zadajte svoje údaje pre registráciu
            </p>
        </div>
        
        <div className="flex justify-center">
            <RegisterForm />
        </div>
        
        <p className="px-8 text-center text-xs text-muted-foreground">
            Už máte účet?{" "}
            <Link href="/auth" className="underline hover:text-primary">
                Prihlásiť sa
            </Link>
        </p>
      </div>
    </div>
  )
}
