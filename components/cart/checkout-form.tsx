"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  Lock,
  Info,
  ShoppingCart,
} from "lucide-react";
import type { CartData } from "@/types/cart";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import type { CustomerMode } from "@/components/print/types";
import { ModeButton } from "@/components/print/mode-button";
import { PriceDisplay } from "@/components/print/price-display";
import { PaymentMethodSelector } from "@/components/print/payment-method-selector";
import { CheckoutSteps } from "@/components/print/checkout-steps";
import { AddressForm } from "@/components/print/address-form";
import { OrderReview } from "@/components/print/order-review";
import { getCsrfHeader } from "@/lib/csrf";

interface CheckoutFormProps {
  cart: CartData;
  mode: CustomerMode;
  initialBillingData?: Partial<CheckoutBillingData> | null;
  savedAddresses?: SavedAddress[];
}

type PendingOrderUpload = {
  file: File;
};

type SavedAddress = {
  id: string;
  label: string;
  street: string;
  apt?: string | null;
  city: string;
  zipCode: string;
  country: string;
  isDefault?: boolean | null;
};

type CheckoutBillingData = {
  companyName: string;
  ico: string;
  dic: string;
  icDph: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  apt: string;
  city: string;
  zipCode: string;
  country: string;
};

declare global {
  interface Window {
    __pendingOrderUpload?: PendingOrderUpload;
  }
}

const stripePublicKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const stripeMode = (process.env.NEXT_PUBLIC_STRIPE_MODE ?? "").toLowerCase();
const isStripeTestMode = stripeMode === "test";

// Lazy load Stripe SDK только когда нужен
let stripePromiseCache: ReturnType<typeof loadStripe> | null = null;
const getStripePromise = () => {
  if (!stripePublicKey) return null;
  if (!stripePromiseCache) {
    stripePromiseCache = loadStripe(stripePublicKey);
  }
  return stripePromiseCache;
};

type PaymentFormProps = {
  orderId: string;
  onError: (message: string) => void;
  onProcessing: (value: boolean) => void;
  mode: CustomerMode;
};

function PaymentForm({ orderId, onError, onProcessing, mode }: PaymentFormProps) {
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
      <ModeButton
        mode={mode}
        variant="primary"
        size="lg"
        type="submit"
        className="w-full"
        disabled={!stripe || isPaying}
      >
        {isPaying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Zaplatiť
      </ModeButton>
      <p className="text-center text-xs text-muted-foreground">
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

const formatStreetLine = (street: string, apt?: string) =>
  apt ? `${street}, ${apt}` : street;

const buildBillingData = (
  initial?: Partial<CheckoutBillingData> | null
): CheckoutBillingData => ({
  companyName: initial?.companyName ?? "",
  ico: initial?.ico ?? "",
  dic: initial?.dic ?? "",
  icDph: initial?.icDph ?? "",
  firstName: initial?.firstName ?? "",
  lastName: initial?.lastName ?? "",
  email: initial?.email ?? "",
  phone: initial?.phone ?? "",
  street: initial?.street ?? "",
  apt: initial?.apt ?? "",
  city: initial?.city ?? "",
  zipCode: initial?.zipCode ?? "",
  country: initial?.country ?? "SK",
});

export function CheckoutForm({
  cart,
  mode,
  initialBillingData,
  savedAddresses = [],
}: CheckoutFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [saveCard, setSaveCard] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isPreparingPayment, setIsPreparingPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"bank" | "stripe">("bank");
  const isPreparingRef = useRef(false);
  const initialBilling = buildBillingData(initialBillingData);
  const defaultSavedAddress =
    savedAddresses.find((address) => address.isDefault) ?? savedAddresses[0];
  const [billingData, setBillingData] = useState<CheckoutBillingData>(
    initialBilling
  );
  const [deliveryDifferent, setDeliveryDifferent] = useState(false);
  const [deliveryData, setDeliveryData] = useState({
    firstName: initialBilling.firstName,
    lastName: initialBilling.lastName,
    email: initialBilling.email,
    phone: initialBilling.phone,
    street: defaultSavedAddress?.street ?? "",
    apt: defaultSavedAddress?.apt ?? "",
    city: defaultSavedAddress?.city ?? "",
    zipCode: defaultSavedAddress?.zipCode ?? "",
    country: defaultSavedAddress?.country ?? initialBilling.country ?? "SK",
  });
  const [selectedDeliveryAddressId, setSelectedDeliveryAddressId] = useState(
    defaultSavedAddress?.id ?? ""
  );
  const hasSavedAddresses = savedAddresses.length > 0;
  const hasMultipleSavedAddresses = savedAddresses.length > 1;
  const formatSavedAddressDetails = (address?: SavedAddress) => {
    if (!address) return "";
    const streetLine = address.apt ? `${address.street}, ${address.apt}` : address.street;
    return `${streetLine}, ${address.zipCode} ${address.city}`;
  };
  const formatSavedAddressLabel = (address?: SavedAddress) => {
    if (!address) return "";
    return `${address.label} – ${formatSavedAddressDetails(address)}`;
  };
  const [notes, setNotes] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("sk-SK", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const steps =
    mode === "b2c"
      ? [
          {
            number: 1,
            title: "Kontakt a doručenie",
            description: "Kontaktné údaje a doručenie",
          },
          { number: 2, title: "Platba", description: "Spôsob platby" },
          { number: 3, title: "Dokončenie", description: "Kontrola a potvrdenie" },
        ]
      : [
          { number: 1, title: "Prezeranie", description: "Kontrola košíka" },
          {
            number: 2,
            title: "Fakturácia a doručenie",
            description: "Firemné údaje a adresa",
          },
          { number: 3, title: "Platba", description: "Spôsob úhrady" },
          { number: 4, title: "Dokončenie", description: "Potvrdenie" },
        ];

  const infoStep = mode === "b2c" ? 1 : 2;
  const paymentStep = mode === "b2c" ? 2 : 3;
  const reviewStep = mode === "b2c" ? 3 : 4;

  const handleBillingChange = (field: string, value: string) => {
    setBillingData((prev) => ({ ...prev, [field]: value }));
  };

  const handleDeliveryChange = (field: string, value: string) => {
    setDeliveryData((prev) => ({ ...prev, [field]: value }));
  };

  const applySavedAddress = useCallback((address: SavedAddress) => {
    setDeliveryData((prev) => ({
      ...prev,
      street: address.street,
      apt: address.apt ?? "",
      city: address.city,
      zipCode: address.zipCode,
      country: address.country,
    }));
  }, []);

  const handleSelectSavedAddress = (value: string) => {
    setSelectedDeliveryAddressId(value);
    const selected = savedAddresses.find((address) => address.id === value);
    if (selected) {
      applySavedAddress(selected);
    }
  };

  useEffect(() => {
    if (!deliveryDifferent) return;
    setDeliveryData((prev) => ({
      ...prev,
      firstName: prev.firstName || billingData.firstName,
      lastName: prev.lastName || billingData.lastName,
      email: prev.email || billingData.email,
      phone: prev.phone || billingData.phone,
    }));
  }, [billingData, deliveryDifferent]);

  const customerName = `${billingData.firstName} ${billingData.lastName}`.trim();
  const customerEmail = billingData.email.trim();
  const customerPhone = billingData.phone.trim();

  const canProceedFromBilling =
    billingData.firstName.trim() &&
    billingData.lastName.trim() &&
    billingData.email.trim() &&
    billingData.phone.trim() &&
    billingData.street.trim() &&
    billingData.city.trim() &&
    billingData.zipCode.trim() &&
    billingData.country.trim() &&
    (mode === "b2b"
      ? billingData.companyName.trim() && billingData.ico.trim() && billingData.dic.trim()
      : true);
  const canProceedFromDelivery = deliveryDifferent
    ? deliveryData.firstName.trim() &&
      deliveryData.lastName.trim() &&
      deliveryData.email.trim() &&
      deliveryData.phone.trim() &&
      deliveryData.street.trim() &&
      deliveryData.city.trim() &&
      deliveryData.zipCode.trim() &&
      deliveryData.country.trim()
      : true;

  const createOrderAndUpload = useCallback(async () => {
    const deliverySource = deliveryDifferent
      ? deliveryData
      : {
          firstName: billingData.firstName,
          lastName: billingData.lastName,
          email: billingData.email,
          phone: billingData.phone,
          street: billingData.street,
          apt: billingData.apt,
          city: billingData.city,
          zipCode: billingData.zipCode,
          country: billingData.country,
        };

    const billingAddressPayload = {
      name: customerName || billingData.companyName,
      companyName: billingData.companyName || undefined,
      ico: billingData.ico || undefined,
      dic: billingData.dic || undefined,
      icDph: billingData.icDph || undefined,
      street: formatStreetLine(billingData.street, billingData.apt),
      postalCode: billingData.zipCode,
      city: billingData.city,
      country: billingData.country,
    };

    const shippingAddressPayload = {
      name: `${deliverySource.firstName} ${deliverySource.lastName}`.trim(),
      street: formatStreetLine(deliverySource.street, deliverySource.apt),
      postalCode: deliverySource.zipCode,
      city: deliverySource.city,
      country: deliverySource.country,
    };

    const deliveryDetails = deliveryDifferent
      ? [
          "Adresa doručenia:",
          deliveryData.firstName || deliveryData.lastName
            ? `Meno: ${`${deliveryData.firstName} ${deliveryData.lastName}`.trim()}`
            : null,
          deliveryData.email ? `Email: ${deliveryData.email}` : null,
          deliveryData.phone ? `Telefón: ${deliveryData.phone}` : null,
          deliveryData.street ? `Ulica: ${deliveryData.street}` : null,
          deliveryData.apt ? `Apartmán / byt: ${deliveryData.apt}` : null,
          deliveryData.city ? `Mesto: ${deliveryData.city}` : null,
          deliveryData.zipCode ? `PSČ: ${deliveryData.zipCode}` : null,
          deliveryData.country ? `Krajina: ${deliveryData.country}` : null,
        ]
          .filter(Boolean)
          .join("\n")
      : null;

    const extraNotes = [
      billingData.companyName ? `Spoločnosť: ${billingData.companyName}` : null,
      billingData.ico ? `IČO: ${billingData.ico}` : null,
      billingData.dic ? `DIČ: ${billingData.dic}` : null,
      billingData.icDph ? `IČ DPH: ${billingData.icDph}` : null,
      deliveryDetails,
    ]
      .filter(Boolean)
      .join("\n");

    const data = {
      customerName,
      customerEmail,
      customerPhone,
      billingAddress: billingAddressPayload,
      shippingAddress: shippingAddressPayload,
      notes: [notes.trim(), extraNotes].filter(Boolean).join("\n\n"),
    };

    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
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
          headers: { "Content-Type": "application/json", ...getCsrfHeader() },
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
          headers: { "Content-Type": "application/json", ...getCsrfHeader() },
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
  }, [billingData, deliveryData, deliveryDifferent, notes, customerEmail, customerName, customerPhone]);

  const preparePayment = useCallback(async () => {
    if (paymentMethod !== "stripe") {
      return;
    }
    // Защита от дублирования вызовов через ref
    if (isPreparingRef.current || clientSecret || orderId) {
      return;
    }
    if (!customerName.trim() || !customerEmail.trim()) {
      setError("Meno a e-mail sú povinné.");
      return;
    }

    isPreparingRef.current = true;
    setIsPreparingPayment(true);
    setIsSubmitting(true);
    setError(null);

    const stripeInstance = getStripePromise();
    if (!stripeInstance) {
      setError("Chýba Stripe publishable key.");
      setIsSubmitting(false);
      setIsPreparingPayment(false);
      isPreparingRef.current = false;
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
      // НЕ сбрасываем isPreparingRef - заказ уже создан
    } catch (err) {
      setError(err instanceof Error ? err.message : "Neznáma chyba");
      setIsSubmitting(false);
      setIsPreparingPayment(false);
      isPreparingRef.current = false;
    }
  }, [
    clientSecret,
    orderId,
    customerName,
    customerEmail,
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

  const getItemConfiguration = (item: CartData["items"][number]) => {
    const attributes = getSelectedOptionAttributes(item.selectedOptions);
    const attributeValues = attributes ? Object.values(attributes).filter(Boolean) : [];
    const sizePart =
      item.width && item.height ? `${item.width} × ${item.height} cm` : null;
    return [sizePart, ...attributeValues].filter(Boolean).join(", ");
  };

  const orderItems = cart.items.map((item) => ({
    id: item.id,
    productName: item.product.name,
    quantity: item.quantity,
    pricePerUnit: item.priceSnapshot?.gross || 0,
    configuration: getItemConfiguration(item) || "—",
  }));

  const paymentLabel =
    paymentMethod === "stripe" ? "Platobná karta" : "Bankový prevod";

  const handleEditStep = (step: number) => {
    setCurrentStep(step);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-6">
      <CheckoutSteps mode={mode} currentStep={currentStep} steps={steps} />
      {isStripeTestMode && (
        <Alert>
          <AlertDescription>
            Testovací režim Stripe je zapnutý. Použite testovaciu kartu 4242 4242 4242 4242,
            akýkoľvek dátum v budúcnosti a ľubovoľné CVC.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
        {mode === "b2b" && currentStep === 1 && (
          <Card className="p-6">
            <h3 className="mb-4 text-lg font-semibold">Kontrola objednávky</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Skontrolujte položky vo vašom košíku pred pokračovaním na zadanie firemných údajov.
            </p>

            <div className="space-y-3">
              {cart.items.map((item) => {
                const itemPrice = item.priceSnapshot?.gross || 0;
                const itemTotal = itemPrice * item.quantity;
                return (
                  <div key={item.id} className="flex justify-between border-b border-border pb-3">
                    <div>
                      <div className="font-medium">{item.product.name}</div>
                      <div className="text-sm text-muted-foreground">{item.quantity} ks</div>
                    </div>
                    <div className="font-semibold">
                      <PriceDisplay price={itemTotal} mode={mode} size="sm" />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-lg border border-border bg-muted/50 p-4">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Ako B2B zákazník získate prístup k objemovým zľavám a osobnému account manažérovi.
                </p>
              </div>
            </div>
          </Card>
        )}

        {currentStep === infoStep && (
          <>
            <AddressForm
              mode={mode}
              title={mode === "b2c" ? "Kontaktné a fakturačné údaje" : "Fakturačné údaje"}
              showCompanyFields={mode === "b2b"}
              values={billingData}
              onChange={handleBillingChange}
            />

            <Card className="p-6">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="different-delivery"
                  checked={deliveryDifferent}
                  onChange={(event) => {
                    const nextValue = event.target.checked;
                    setDeliveryDifferent(nextValue);
                    if (nextValue && defaultSavedAddress) {
                      setSelectedDeliveryAddressId(defaultSavedAddress.id);
                      applySavedAddress(defaultSavedAddress);
                    }
                  }}
                  className="h-4 w-4 rounded border-border"
                />
                <label htmlFor="different-delivery" className="text-sm font-medium">
                  Doručiť na inú adresu
                </label>
              </div>
            </Card>

            {deliveryDifferent && hasSavedAddresses && (
              <Card className="p-6">
                <div className="space-y-3">
                  <div className="text-sm font-semibold">Uložené adresy</div>
                  {hasMultipleSavedAddresses ? (
                    <select
                      value={selectedDeliveryAddressId}
                      onChange={(event) => handleSelectSavedAddress(event.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savedAddresses.map((address) => (
                        <option key={address.id} value={address.id}>
                          {formatSavedAddressLabel(address)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border bg-muted/40 p-3 text-sm">
                      <div className="font-medium">{savedAddresses[0]?.label}</div>
                      <div className="text-muted-foreground">
                        {formatSavedAddressDetails(savedAddresses[0])}
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Adresu môžete upraviť aj ručne v nasledujúcom formulári.
                  </p>
                </div>
              </Card>
            )}

            {deliveryDifferent && (
              <AddressForm
                mode={mode}
                title={mode === "b2c" ? "Adresa doručenia" : "Adresa dodania"}
                showCompanyFields={false}
                values={deliveryData}
                onChange={handleDeliveryChange}
              />
            )}
          </>
        )}

        {currentStep === paymentStep && (
          <>
            <PaymentMethodSelector
              mode={mode}
              selected={paymentMethod}
              onSelect={(next) => {
                setPaymentMethod(next);
                if (next === "stripe") {
                  preparePayment();
                }
              }}
            />

            {paymentMethod === "stripe" && (
              <Card className="p-6">
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
                    <label htmlFor="saveCard" className="text-sm leading-tight">
                      Uložiť kartu pre budúce platby
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Uloženie karty vyžaduje prihlásenie.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            <Card className="p-6">
              <h3 className="mb-2 text-lg font-semibold">Poznámka k objednávke</h3>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Doplňujúce informácie k objednávke..."
                rows={4}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                disabled={isSubmitting}
              />
            </Card>
          </>
        )}

        {currentStep === reviewStep && (
          <>
            <OrderReview
              mode={mode}
              items={orderItems}
              shippingMethod="Kuriér"
              shippingCost={0}
              paymentMethod={paymentLabel}
              billingAddress={{
                companyName: billingData.companyName,
                name: customerName,
                street: formatStreetLine(billingData.street, billingData.apt),
                city: billingData.city,
                zipCode: billingData.zipCode,
                country: billingData.country,
              }}
              deliveryAddress={
                deliveryDifferent
                  ? {
                      name: `${deliveryData.firstName} ${deliveryData.lastName}`.trim(),
                      street: formatStreetLine(deliveryData.street, deliveryData.apt),
                      city: deliveryData.city,
                      zipCode: deliveryData.zipCode,
                      country: deliveryData.country,
                    }
                  : undefined
              }
              onEditStep={handleEditStep}
              editSteps={{
                items: mode === "b2c" ? infoStep : 1,
                shipping: infoStep,
                billing: infoStep,
                payment: paymentStep,
              }}
            />

            <Card className="p-6">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="terms"
                  checked={acceptedTerms}
                  onChange={(event) => setAcceptedTerms(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-border"
                />
                <label htmlFor="terms" className="text-sm text-muted-foreground">
                  Súhlasím s{" "}
                  <a href="#" className="font-medium text-primary hover:underline">
                    obchodnými podmienkami
                  </a>{" "}
                  a{" "}
                  <a href="#" className="font-medium text-primary hover:underline">
                    ochranou osobných údajov
                  </a>
                </label>
              </div>
            </Card>
          </>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-4">
          {currentStep > 1 && (
            <ModeButton
              mode={mode}
              variant="outline"
              size="lg"
              type="button"
              onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
            >
              Späť
            </ModeButton>
          )}
          {currentStep < steps.length && (
            <ModeButton
              mode={mode}
              variant="primary"
              size="lg"
              type="button"
              className="flex-1"
              onClick={() => {
                if (currentStep === infoStep && !canProceedFromBilling) {
                  setError("Vyplňte povinné údaje.");
                  return;
                }
                if (currentStep === infoStep && !canProceedFromDelivery) {
                  setError("Vyplňte adresu doručenia.");
                  return;
                }
                setError(null);
                setCurrentStep((prev) => Math.min(steps.length, prev + 1));
              }}
            >
              Pokračovať
            </ModeButton>
          )}
        </div>
      </div>

      <div className="lg:col-span-1">
        <div className="sticky top-24 space-y-4">
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">Zhrnutie</h3>
            </div>

            <div className="mb-4 space-y-3">
              {cart.items.map((item) => {
                const itemPrice = item.priceSnapshot?.gross || 0;
                const itemTotal = itemPrice * item.quantity;
                return (
                  <div key={item.id} className="flex justify-between text-sm">
                    <div className="flex-1">
                      <div className="font-medium">{item.product.name}</div>
                      <div className="text-muted-foreground">{item.quantity} ks</div>
                    </div>
                    <div className="font-medium">
                      <PriceDisplay price={itemTotal} mode={mode} size="sm" />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Medzisúčet:</span>
                <PriceDisplay price={cart.totals.subtotal} mode={mode} size="sm" />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">DPH:</span>
                <span>{formatPrice(cart.totals.vatAmount)}</span>
              </div>
              <div className="border-t border-border pt-2">
                <div className="flex justify-between text-lg font-bold">
                  <span>Celkom:</span>
                  {mode === "b2c" ? (
                    <PriceDisplay price={cart.totals.total} mode={mode} size="lg" />
                  ) : (
                    <span>{formatPrice(cart.totals.total)}</span>
                  )}
                </div>
              </div>
            </div>

            {isPreparingPayment && (
              <p className="mt-3 text-xs text-muted-foreground text-center">
                Pripravujeme platbu...
              </p>
            )}
          </Card>

          {currentStep === reviewStep && (
            <Card className="p-6">
              <h3 className="mb-3 text-lg font-semibold">Platba</h3>
              {paymentMethod === "bank" && (
                <div className="space-y-3">
                  <ModeButton
                    mode={mode}
                    variant="primary"
                    size="lg"
                    type="button"
                    className="w-full"
                    onClick={handleBankTransfer}
                    disabled={isSubmitting || isPreparingPayment || !acceptedTerms}
                  >
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Potvrdiť objednávku
                  </ModeButton>
                  <p className="text-center text-xs text-muted-foreground">
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
                      <ModeButton
                        mode={mode}
                        variant="outline"
                        size="md"
                        type="button"
                        className="w-full"
                        onClick={preparePayment}
                        disabled={isSubmitting || isPreparingPayment || !acceptedTerms}
                      >
                        {isPreparingPayment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Načítať platobný formulár
                      </ModeButton>
                    </div>
                  )}
                  {clientSecret && orderId && getStripePromise() && (
                    <>
                      <Elements
                        stripe={getStripePromise()}
                        options={{
                          clientSecret,
                          appearance: { theme: "stripe" },
                        }}
                      >
                        <PaymentForm
                          mode={mode}
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
            </Card>
          )}

          <Card className="p-4">
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-green-600" />
                <span className="text-muted-foreground">100% zabezpečená platba</span>
              </div>
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-green-600" />
                <span className="text-muted-foreground">Kontrola súborov zdarma</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
      </div>
    </div>
  );
}
