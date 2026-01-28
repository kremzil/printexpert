import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { requireAdmin } from "@/lib/auth-helpers"
import { getShopSettings } from "@/lib/shop-settings"
import { updateShopVatRate } from "./actions"

export default async function AdminSettingsPage() {
  await requireAdmin()

  const settings = await getShopSettings()

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Nastavenia</h1>
        <p className="text-sm text-muted-foreground">
          Centrálne nastavenia pre obchod a výpočty cien.
        </p>
      </header>

      <Tabs defaultValue="shop">
        <TabsList>
          <TabsTrigger value="shop">Obchod</TabsTrigger>
        </TabsList>
        <TabsContent value="shop" className="space-y-4">
          <Tabs defaultValue="vat">
            <TabsList>
              <TabsTrigger value="vat">DPH</TabsTrigger>
            </TabsList>
            <TabsContent value="vat">
              <Card>
                <CardHeader>
                  <CardTitle>DPH</CardTitle>
                  <CardDescription>
                    Sadzba DPH platná pre všetky produkty v obchode.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form action={updateShopVatRate} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="vatRate">Sadzba DPH</Label>
                      <Input
                        id="vatRate"
                        name="vatRate"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        defaultValue={settings.vatRate.toString()}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Zadajte desatinné číslo (napr. 0,20 pre 20&nbsp;%).
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Nastavenie sa použije pri všetkých výpočtoch.</span>
                      <Button type="submit" size="sm">
                        Uložiť
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </section>
  )
}
