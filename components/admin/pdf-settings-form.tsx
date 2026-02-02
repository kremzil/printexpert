"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminButton as Button } from "@/components/admin/admin-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import type { PdfSettings } from "@/lib/pdf/types";

const orderStatuses = [
  { value: "PENDING", label: "Čaká sa" },
  { value: "CONFIRMED", label: "Potvrdená" },
  { value: "PROCESSING", label: "Spracováva sa" },
  { value: "COMPLETED", label: "Dokončená" },
];

export function PdfSettingsForm() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const form = useForm<PdfSettings>({
    defaultValues: {
      companyName: "",
      companyAddress: "",
      companyCity: "",
      companyIco: "",
      companyDic: "",
      companyIcDph: "",
      bankName: "",
      bankBic: "",
      bankCode: "",
      bankIban: "",
      logoUrl: "",
      signatureUrl: "",
      footerText: "",
      autoGenerateOnStatus: "CONFIRMED",
      autoSendEmail: true,
      invoicePrefix: "",
      invoiceNextNumber: 1,
      paymentDueDays: 14,
    },
  });

  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch("/api/admin/settings/pdf");
        if (response.ok) {
          const data = await response.json();
          form.reset(data);
        }
      } catch (error) {
        console.error("Failed to load PDF settings:", error);
        toast.error("Nepodarilo sa načítať nastavenia");
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, [form]);

  async function onSubmit(data: PdfSettings) {
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/settings/pdf", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error ?? "Failed to save");
      }
      
      toast.success("Nastavenia boli uložené");
    } catch (error) {
      console.error("Failed to save PDF settings:", error);
      const message = error instanceof Error ? error.message : "Nepodarilo sa uložiť nastavenia";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Company Info */}
      <Card>
        <CardHeader>
          <CardTitle>Údaje o firme</CardTitle>
          <CardDescription>
            Tieto údaje sa zobrazia na faktúrach ako dodávateľ.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="companyName">Názov firmy</Label>
            <Input
              id="companyName"
              placeholder="SHARK.SK j.s.a."
              {...form.register("companyName")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyAddress">Adresa</Label>
            <Input
              id="companyAddress"
              placeholder="Komenského 40"
              {...form.register("companyAddress")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyCity">Mesto a PSČ</Label>
            <Input
              id="companyCity"
              placeholder="040 01 Košice"
              {...form.register("companyCity")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyIco">IČO</Label>
            <Input
              id="companyIco"
              placeholder="51154439"
              {...form.register("companyIco")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyDic">DIČ</Label>
            <Input
              id="companyDic"
              placeholder="2120614628"
              {...form.register("companyDic")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyIcDph">IČ DPH</Label>
            <Input
              id="companyIcDph"
              placeholder="SK2120614628"
              {...form.register("companyIcDph")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Bank Info */}
      <Card>
        <CardHeader>
          <CardTitle>Bankové údaje</CardTitle>
          <CardDescription>
            Platobné údaje zobrazené na faktúrach.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="bankName">Názov banky</Label>
            <Input
              id="bankName"
              placeholder="Československá obchodná banka, a.s."
              {...form.register("bankName")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bankBic">BIC</Label>
            <Input
              id="bankBic"
              placeholder="CEKOSKBX"
              {...form.register("bankBic")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bankCode">Kód banky</Label>
            <Input
              id="bankCode"
              placeholder="7500"
              {...form.register("bankCode")}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="bankIban">IBAN</Label>
            <Input
              id="bankIban"
              placeholder="SK4175000000004025159032"
              {...form.register("bankIban")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Invoice Numbering */}
      <Card>
        <CardHeader>
          <CardTitle>Číslovanie faktúr</CardTitle>
          <CardDescription>
            Nastavenie formátu čísla faktúry.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="invoicePrefix">Prefix</Label>
            <Input
              id="invoicePrefix"
              placeholder=""
              {...form.register("invoicePrefix")}
            />
            <p className="text-xs text-muted-foreground">
              Napr. prázdny alebo &quot;FV&quot;
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoiceNextNumber">Ďalšie číslo</Label>
            <Input
              id="invoiceNextNumber"
              type="number"
              min={1}
              {...form.register("invoiceNextNumber", { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paymentDueDays">Splatnosť (dni)</Label>
            <Input
              id="paymentDueDays"
              type="number"
              min={1}
              {...form.register("paymentDueDays", { valueAsNumber: true })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Auto-generation */}
      <Card>
        <CardHeader>
          <CardTitle>Automatická generácia</CardTitle>
          <CardDescription>
            Nastavenie automatického vytvárania a odosielania faktúr.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="autoGenerateOnStatus">Generovať pri stave</Label>
            <Select
              value={form.watch("autoGenerateOnStatus")}
              onValueChange={(value) => form.setValue("autoGenerateOnStatus", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {orderStatuses.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Faktúra sa automaticky vygeneruje pri zmene stavu objednávky.
            </p>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Odoslať e-mail</Label>
              <p className="text-xs text-muted-foreground">
                Automaticky odoslať faktúru zákazníkovi na e-mail.
              </p>
            </div>
            <Switch
              checked={form.watch("autoSendEmail")}
              onCheckedChange={(checked) => form.setValue("autoSendEmail", checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* PDF Customization */}
      <Card>
        <CardHeader>
          <CardTitle>Vzhľad faktúry</CardTitle>
          <CardDescription>
            Prispôsobenie vizuálu PDF dokumentov.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="logoUrl">URL loga</Label>
            <Input
              id="logoUrl"
              type="url"
              placeholder="https://..."
              {...form.register("logoUrl")}
            />
            <p className="text-xs text-muted-foreground">
              Odporúčaná veľkosť: 200x80px, formát PNG alebo JPG.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="signatureUrl">URL podpisu/pečiatky</Label>
            <Input
              id="signatureUrl"
              type="url"
              placeholder="https://..."
              {...form.register("signatureUrl")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="footerText">Text v päte</Label>
            <Textarea
              id="footerText"
              placeholder="Výpis z Obchodného registra..."
              {...form.register("footerText")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Ukladám...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Uložiť nastavenia
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
