"use client";

import { useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import type { CartData } from "@/types/cart";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

interface CheckoutFormProps {
  cart: CartData;
}

type PendingOrderUpload = {
  file: File;
};

declare global {
  interface Window {
    __pendingOrderUpload?: PendingOrderUpload;
  }
}

const stripePublicKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const stripeMode = (process.env.NEXT_PUBLIC_STRIPE_MODE ?? "").toLowerCase();
const isStripeTestMode = stripeMode === "test";
const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null;

type PaymentFormProps = {
  orderId: string;
  onError: (message: string) => void;
  onProcessing: (value: boolean) => void;
};

function PaymentForm({ orderId, onError, onProcessing }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isPaying, setIsPaying] = useState(false);

  const handlePay = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stripe || !elements) {
      onError("Stripe sa ešte načítava.");
      return;
    }

    setIsPaying(true);
    onProcessing(true);

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/success?orderId=${orderId}`,
      },
      redirect: "if_required",
    });

    if (result.error) {
      onError(result.error.message || "Platba zlyhala.");
      setIsPaying(false);
      onProcessing(false);
      return;
    }

    if (result.paymentIntent?.status === "succeeded") {
      window.location.href = `/checkout/success?orderId=${orderId}`;
      return;
    }

    onProcessing(false);
    setIsPaying(false);
  };

  return (
    <form onSubmit={handlePay} className="space-y-4">
      <PaymentElement />
      <Button type="submit" className="w-full" size="lg" disabled={!stripe || isPaying}>
        {isPaying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Zaplatiť
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        Platbu spracúva Stripe. Podporované sú karty aj Link.
      </p>
    </form>
  );
}

const getSelectedOptionAttributes = (selectedOptions: unknown): Record<string, string> | null => {
  if (!selectedOptions || typeof selectedOptions !== "object") {
    return null;
  }

  if (!("_attributes" in selectedOptions)) {
    return null;
  }

  const attributes = (selectedOptions as { _attributes?: unknown })._attributes;

  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
    return null;
  }

  return attributes as Record<string, string>;
};

export function CheckoutForm({ cart }: CheckoutFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [saveCard, setSaveCard] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isPreparingPayment, setIsPreparingPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"bank" | "stripe">("bank");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("sk-SK", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const createOrderAndUpload = useCallback(async () => {
    const data = {
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone.trim(),
      notes: notes.trim(),
    };

    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Chyba pri vytváraní objednávky");
    }

    const order = await response.json();
    let uploadFailed = false;

    const pendingUpload = window.__pendingOrderUpload;
    if (pendingUpload?.file) {
      try {
        const file = pendingUpload.file;
        const presignResponse = await fetch("/api/uploads/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: order.id,
            kind: "ARTWORK",
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
          }),
        });

        if (!presignResponse.ok) {
          throw new Error("Nepodarilo sa pripraviť nahrávanie.");
        }

        const presignData = await presignResponse.json();
        const uploadResponse = await fetch(presignData.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error("Nahrávanie zlyhalo.");
        }

        const confirmResponse = await fetch("/api/uploads/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetId: presignData.assetId }),
        });

        if (!confirmResponse.ok) {
          throw new Error("Potvrdenie nahratia zlyhalo.");
        }
      } catch (uploadError) {
        console.error("Checkout upload error:", uploadError);
        uploadFailed = true;
      } finally {
        delete window.__pendingOrderUpload;
      }
    }

    window.dispatchEvent(new Event("cart-updated"));

    return { orderId: order.id as string, uploadFailed };
  }, [customerEmail, customerName, customerPhone, notes]);

  const preparePayment = useCallback(async () => {
    if (paymentMethod !== "stripe") {
      return;
    }
    if (clientSecret || isSubmitting || isPreparingPayment) {
      return;
    }
    if (!customerName.trim() || !customerEmail.trim()) {
      setError("Meno a e-mail sú povinné.");
      return;
    }

    setIsPreparingPayment(true);
    setIsSubmitting(true);
    setError(null);

    if (!stripePromise) {
      setError("Chýba Stripe publishable key.");
      setIsSubmitting(false);
      setIsPreparingPayment(false);
      return;
    }

    try {
      const { orderId: createdOrderId, uploadFailed } = await createOrderAndUpload();

      const checkoutResponse = await fetch("/api/stripe/payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: createdOrderId,
          saveCard,
          customerEmail: customerEmail.trim(),
        }),
      });

      if (!checkoutResponse.ok) {
        const checkoutError = await checkoutResponse.json().catch(() => ({}));
        throw new Error(checkoutError.error || "Nepodarilo sa spustiť platbu.");
      }

      const checkoutData = await checkoutResponse.json();
      if (!checkoutData?.clientSecret) {
        throw new Error("Chýba client secret pre platbu.");
      }

      if (uploadFailed) {
        console.warn("Upload failed during checkout.");
      }

      setOrderId(createdOrderId);
      setClientSecret(checkoutData.clientSecret as string);
      setIsSubmitting(false);
      setIsPreparingPayment(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Neznáma chyba");
      setIsSubmitting(false);
      setIsPreparingPayment(false);
    }
  }, [
    clientSecret,
    isSubmitting,
    isPreparingPayment,
    customerName,
    customerEmail,
    customerPhone,
    notes,
    saveCard,
    createOrderAndUpload,
    paymentMethod,
  ]);

  const handleBankTransfer = useCallback(async () => {
    if (isSubmitting || isPreparingPayment) return;
    if (!customerName.trim() || !customerEmail.trim()) {
      setError("Meno a e-mail sú povinné.");
      return;
    }
    if (orderId) {
      window.location.href = `/account/orders/${orderId}?success=true`;
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const { orderId: createdOrderId, uploadFailed } = await createOrderAndUpload();
      const uploadParam = uploadFailed ? "&upload=failed" : "";
      window.location.href = `/account/orders/${createdOrderId}?success=true${uploadParam}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Neznáma chyba");
      setIsSubmitting(false);
    }
  }, [
    createOrderAndUpload,
    customerEmail,
    customerName,
    isPreparingPayment,
    isSubmitting,
    orderId,
  ]);

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        {isStripeTestMode && (
          <Alert>
            <AlertDescription>
              Testovací režim Stripe je zapnutý. Použite testovaciu kartu 4242 4242 4242 4242,
              akýkoľvek dátum v budúcnosti a ľubovoľné CVC.
            </AlertDescription>
          </Alert>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Kontaktné údaje</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="customerName">
                Meno a priezvisko <span className="text-destructive">*</span>
              </Label>
              <Input
                id="customerName"
                name="customerName"
                required
                placeholder="Ján Novák"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                onBlur={preparePayment}
                disabled={isSubmitting || Boolean(clientSecret)}
              />
            </div>

            <div>
              <Label htmlFor="customerEmail">
                E-mail <span className="text-destructive">*</span>
              </Label>
              <Input
                id="customerEmail"
                name="customerEmail"
                type="email"
                required
                placeholder="jan.novak@example.com"
                value={customerEmail}
                onChange={(event) => setCustomerEmail(event.target.value)}
                onBlur={preparePayment}
                disabled={isSubmitting || Boolean(clientSecret)}
              />
            </div>

            <div>
              <Label htmlFor="customerPhone">Telefón</Label>
              <Input
                id="customerPhone"
                name="customerPhone"
                type="tel"
                placeholder="+421 XXX XXX XXX"
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                disabled={isSubmitting || Boolean(clientSecret)}
              />
            </div>
            {paymentMethod === "stripe" && (
              <div className="flex items-start gap-2">
                <input
                  id="saveCard"
                  name="saveCard"
                  type="checkbox"
                  checked={saveCard}
                  onChange={(event) => setSaveCard(event.target.checked)}
                  disabled={isSubmitting || Boolean(clientSecret)}
                  className="mt-1 h-4 w-4 rounded border border-input"
                />
                <div className="space-y-1">
                  <Label htmlFor="saveCard" className="text-sm leading-tight">
                    Uložiť kartu pre budúce platby
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Uloženie karty vyžaduje prihlásenie.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      <Card>
        <CardHeader>
          <CardTitle>Spôsob platby</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={paymentMethod}
            onValueChange={(value) => {
              const nextValue = value === "stripe" ? "stripe" : "bank";
              setPaymentMethod(nextValue);
              if (nextValue === "stripe") {
                preparePayment();
              }
            }}
            className="space-y-4"
          >
            <div className="flex items-start gap-3">
              <RadioGroupItem value="bank" id="payment-bank" className="mt-1" />
              <div className="space-y-2">
                <Label htmlFor="payment-bank" className="text-sm font-medium">
                  Priamy vklad na účet
                </Label>
                <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                  Uskutočnite platbu priamo na náš bankový účet. Ako referenciu pre platbu
                  použite svoje ID objednávky. Vaša objednávka bude odoslaná až po pripísaní
                  prostriedkov na náš účet.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <RadioGroupItem value="stripe" id="payment-stripe" className="mt-1" />
              <div className="space-y-1">
                <Label htmlFor="payment-stripe" className="text-sm font-medium">
                  Stripe
                </Label>
                <p className="text-xs text-muted-foreground">
                  Platba kartou alebo Link priamo na stránke.
                </p>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Poznámka k objednávke</CardTitle>
        </CardHeader>
          <CardContent>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Doplňujúce informácie k objednávke..."
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={isSubmitting}
            />
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      <div className="lg:col-span-1">
        <Card className="sticky top-4">
          <CardHeader>
            <CardTitle>Súhrn objednávky</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {cart.items.map((item) => {
                const itemPrice = item.priceSnapshot?.gross || 0;
                const itemTotal = itemPrice * item.quantity;
                return (
                  <div key={item.id} className="space-y-1 pb-2 border-b last:border-0 last:pb-0">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {item.product.name} × {item.quantity}
                      </span>
                      <span>{formatPrice(itemTotal)}</span>
                    </div>
                    {(() => {
                      const attributes = getSelectedOptionAttributes(item.selectedOptions);

                      if (!attributes || Object.keys(attributes).length === 0) {
                        return null;
                      }

                      return (
                        <div className="text-xs text-muted-foreground pl-2">
                          {Object.entries(attributes).map(([key, value]) => (
                            <div key={key}>{key}: {value}</div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>

            <div className="border-t pt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Medzisoučet</span>
                <span>{formatPrice(cart.totals.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">DPH</span>
                <span>{formatPrice(cart.totals.vatAmount)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-semibold text-base">
                <span>Celkom</span>
                <span>{formatPrice(cart.totals.total)}</span>
              </div>
            </div>

            {isPreparingPayment && (
              <p className="text-xs text-muted-foreground text-center">
                Pripravujeme platbu...
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Platba</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentMethod === "bank" && (
              <div className="space-y-3">
                <Button
                  type="button"
                  className="w-full"
                  onClick={handleBankTransfer}
                  disabled={isSubmitting || isPreparingPayment}
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Potvrdiť objednávku
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Pokyny k platbe uvidíte po vytvorení objednávky.
                </p>
              </div>
            )}
            {paymentMethod === "stripe" && (
              <>
                {!clientSecret && (
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>
                      Vyplňte kontaktné údaje, aby sme mohli pripraviť platbu.
                    </p>
                    <Button
                      type="button"
                      className="w-full"
                      onClick={preparePayment}
                      disabled={isSubmitting || isPreparingPayment}
                    >
                      {isPreparingPayment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Načítať platobný formulár
                    </Button>
                  </div>
                )}
                {clientSecret && orderId && stripePromise && (
                  <>
                    <Elements
                      stripe={stripePromise}
                      options={{
                        clientSecret,
                        appearance: { theme: "stripe" },
                      }}
                    >
                      <PaymentForm
                        orderId={orderId}
                        onError={(message) => setError(message)}
                        onProcessing={(value) => setIsProcessingPayment(value)}
                      />
                    </Elements>
                    {isProcessingPayment && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Platba sa spracováva. Prosím, neodchádzajte z tejto stránky.
                      </p>
                    )}
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
