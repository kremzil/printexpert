import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminButton } from "@/components/admin/admin-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { requireAdmin } from "@/lib/auth-helpers"
import { getShopSettings } from "@/lib/shop-settings"
import {
  revalidateCatalogCache,
  updateDpdSettings,
  updatePaymentMethods,
  updateShopVatRate,
} from "./actions"
import { PdfSettingsForm } from "@/components/admin/pdf-settings-form"

export default async function AdminSettingsPage() {
  await requireAdmin()

  const settings = await getShopSettings()

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Nastavenia</h1>
        <p className="text-muted-foreground">
          Centrálne nastavenia pre obchod a výpočty cien.
        </p>
      </div>

      <Tabs defaultValue="shop">
        <TabsList>
          <TabsTrigger value="shop">Obchod</TabsTrigger>
        </TabsList>
        <TabsContent value="shop" className="space-y-4">
          <Tabs defaultValue="vat">
            <TabsList>
              <TabsTrigger value="vat">DPH</TabsTrigger>
              <TabsTrigger value="pdf">PDF / Faktúry</TabsTrigger>
              <TabsTrigger value="dpd">DPD</TabsTrigger>
              <TabsTrigger value="payment">Metódy platby</TabsTrigger>
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
                    <div className="space-y-2">
                      <Label htmlFor="pricesIncludeVat">Ceny sú uvedené</Label>
                      <select
                        id="pricesIncludeVat"
                        name="pricesIncludeVat"
                        defaultValue={settings.pricesIncludeVat ? "1" : "0"}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="0">Bez DPH</option>
                        <option value="1">S DPH</option>
                      </select>
                      <p className="text-xs text-muted-foreground">
                        Zvoľte, či sú ceny v cenníkoch zadávané s DPH alebo bez DPH.
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Nastavenie sa použije pri všetkých výpočtoch.</span>
                      <AdminButton type="submit" size="sm">
                        Uložiť
                      </AdminButton>
                    </div>
                  </form>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Navigácia a kategórie</CardTitle>
                  <CardDescription>
                    Ručné obnovenie cache pre navigačné menu a zoznam kategórií.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form action={revalidateCatalogCache} className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Ak ste robili hromadné zmeny, obnovte cache manuálne.</span>
                    <AdminButton type="submit" size="sm">
                      Obnoviť cache
                    </AdminButton>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="pdf">
              <PdfSettingsForm />
            </TabsContent>
            <TabsContent value="dpd">
              <Card>
                <CardHeader>
                  <CardTitle>DPD nastavenia exportu</CardTitle>
                  <CardDescription>
                    Predvolené nastavenia pre DPD export a štítky.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form action={updateDpdSettings} className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="delisId">ID delis</Label>
                      <Input id="delisId" name="delisId" defaultValue={settings.dpdSettings.delisId} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="clientEmail">E-mail klienta</Label>
                      <Input id="clientEmail" name="clientEmail" defaultValue={settings.dpdSettings.clientEmail} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="apiKey">API kľúč</Label>
                      <Input id="apiKey" name="apiKey" defaultValue={settings.dpdSettings.apiKey} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bankAccountId">ID bankového účtu</Label>
                      <Input id="bankAccountId" name="bankAccountId" defaultValue={settings.dpdSettings.bankAccountId} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="senderAddressId">ID adresy pre zber</Label>
                      <Input id="senderAddressId" name="senderAddressId" defaultValue={settings.dpdSettings.senderAddressId} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="defaultProduct">Doprava (DPD produkt)</Label>
                      <Input id="defaultProduct" name="defaultProduct" type="number" defaultValue={settings.dpdSettings.defaultProduct} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="labelFormat">Formát štítkov</Label>
                      <select id="labelFormat" name="labelFormat" defaultValue={settings.dpdSettings.labelFormat} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                        <option value="A6">A6</option>
                        <option value="A4">A4</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="labelPosition">Pozícia A4</Label>
                      <select id="labelPosition" name="labelPosition" defaultValue={settings.dpdSettings.labelPosition} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pickupDateOffsetDays">Pickup: dni dopredu</Label>
                      <Input id="pickupDateOffsetDays" name="pickupDateOffsetDays" type="number" defaultValue={settings.dpdSettings.pickupDateOffsetDays} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pickupTimeFrom">Pickup od (HHMM)</Label>
                      <Input id="pickupTimeFrom" name="pickupTimeFrom" defaultValue={settings.dpdSettings.pickupTimeFrom} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pickupTimeTo">Pickup do (HHMM)</Label>
                      <Input id="pickupTimeTo" name="pickupTimeTo" defaultValue={settings.dpdSettings.pickupTimeTo} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mapApiKey">API kľúč mapy</Label>
                      <Input id="mapApiKey" name="mapApiKey" defaultValue={settings.dpdSettings.mapApiKey} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mapLanguage">Jazyk</Label>
                      <select id="mapLanguage" name="mapLanguage" defaultValue={settings.dpdSettings.mapLanguage} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                        <option value="sk">Slovenčina</option>
                        <option value="en">English</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notificationRule">Notifikačné pravidlo</Label>
                      <select id="notificationRule" name="notificationRule" defaultValue={settings.dpdSettings.notificationRule} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                        <option value="1">Preadvice</option>
                        <option value="904">Predict</option>
                        <option value="902">ParcelShop</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notificationChannel">Kanál notifikácie</Label>
                      <select id="notificationChannel" name="notificationChannel" defaultValue={settings.dpdSettings.notificationChannel} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                        <option value="email">E-mail</option>
                        <option value="sms">SMS</option>
                      </select>
                    </div>
                    <div className="col-span-full flex gap-6">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="notificationsEnabled" value="1" defaultChecked={settings.dpdSettings.notificationsEnabled} />
                        Notifikácie
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="mapWidgetEnabled" value="1" defaultChecked={settings.dpdSettings.mapWidgetEnabled} />
                        Povoliť widget mapy
                      </label>
                    </div>
                    <div className="col-span-full flex justify-end">
                      <AdminButton type="submit" size="sm">Uložiť DPD nastavenia</AdminButton>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="payment">
              <Card>
                <CardHeader>
                  <CardTitle>Metódy platby</CardTitle>
                  <CardDescription>
                    Dostupné spôsoby platby v pokladni.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form action={updatePaymentMethods} className="space-y-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="cardEnabled" value="1" defaultChecked={settings.paymentSettings.cardEnabled} />
                      Platobná karta
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="bankTransferEnabled" value="1" defaultChecked={settings.paymentSettings.bankTransferEnabled} />
                      Bankový prevod
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="codEnabled" value="1" defaultChecked={settings.paymentSettings.codEnabled} />
                      COD (Dobierka)
                    </label>
                    <div className="pl-6 space-y-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="codForCourier" value="1" defaultChecked={settings.paymentSettings.codForCourier} />
                        COD pre kuriéra
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="codForPickup" value="1" defaultChecked={settings.paymentSettings.codForPickup} />
                        COD pre pickup point
                      </label>
                    </div>
                    <div className="flex justify-end">
                      <AdminButton type="submit" size="sm">Uložiť metódy platby</AdminButton>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  )
}
