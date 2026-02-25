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
import { trackDataLayerEvent } from "@/lib/analytics/client";
import { buildMarketingItemId } from "@/lib/analytics/item-id";
import { getCsrfHeader } from "@/lib/csrf";
import {
  calculateDpdCourierShippingGross,
  normalizeFreeShippingFrom,
  normalizeCourierPrice,
  normalizeVatRate,
  splitGrossByVat,
} from "@/lib/delivery-pricing";
import type { PaymentMethod } from "@/components/print/payment-method-selector";

interface CheckoutFormProps {
  cart: CartData;
  mode: CustomerMode;
  initialBillingData?: Partial<CheckoutBillingData> | null;
  savedAddresses?: SavedAddress[];
}

type PendingOrderUpload = {
  file: File;
  cartItemId?: string;
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

type CheckoutAddressStorage = {
  billingData?: Partial<CheckoutBillingData>;
  deliveryData?: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    street: string;
    apt: string;
    city: string;
    zipCode: string;
    country: string;
  }>;
  deliveryDifferent?: boolean;
  selectedDeliveryAddressId?: string;
  selectedDeliveryMethod?: "DPD_COURIER" | "DPD_PICKUP" | "PERSONAL_PICKUP";
  selectedPickupPoint?: {
    parcelShopId: string;
    name: string;
    street: string;
    city: string;
    zip: string;
    country: string;
  } | null;
};

declare global {
  interface Window {
    __pendingOrderUpload?: PendingOrderUpload;
    __pendingDesignPdf?: { file: File; cartItemId?: string };
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
  customerEmail: string;
  onError: (message: string) => void;
  onProcessing: (value: boolean) => void;
  mode: CustomerMode;
};

function PaymentForm({
  orderId,
  customerEmail,
  onError,
  onProcessing,
  mode,
}: PaymentFormProps) {
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

    const paymentStartResponse = await fetch("/api/stripe/payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
      body: JSON.stringify({
        orderId,
        customerEmail: customerEmail.trim(),
      }),
    });

    if (!paymentStartResponse.ok) {
      const startError = await paymentStartResponse.json().catch(() => ({}));
      onError(startError.error || "Nepodarilo sa pripraviť platbu.");
      setIsPaying(false);
      onProcessing(false);
      return;
    }

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

const toCheckoutPaymentMethod = (method: PaymentMethod): "STRIPE" | "BANK_TRANSFER" | "COD" => {
  if (method === "cod") return "COD";
  if (method === "bank") return "BANK_TRANSFER";
  return "STRIPE";
};

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
  const addressStorageKey = `checkout-address-v1:${mode}`;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [saveCard, setSaveCard] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isPreparingPayment, setIsPreparingPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("stripe");
  const [deliveryMethod, setDeliveryMethod] = useState<"DPD_COURIER" | "DPD_PICKUP" | "PERSONAL_PICKUP">("DPD_COURIER");
  const [pickupPoint, setPickupPoint] = useState<CheckoutAddressStorage["selectedPickupPoint"]>(null);
  const [pickupPointEnabled, setPickupPointEnabled] = useState(true);
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState<PaymentMethod[]>(["bank", "stripe", "cod"]);
  const [dpdCourierPrice, setDpdCourierPrice] = useState(4.99);
  const [dpdCourierFreeFrom, setDpdCourierFreeFrom] = useState(100);
  const [shopVatRate, setShopVatRate] = useState(0.2);
  const isPreparingRef = useRef(false);
  const hasTrackedBeginCheckoutRef = useRef(false);
  const initialBilling = buildBillingData(initialBillingData);
  const defaultSavedAddress =
    savedAddresses.find((address) => address.isDefault) ?? savedAddresses[0];
  const [billingData, setBillingData] = useState<CheckoutBillingData>(
    initialBilling
  );
  const [hasHydratedAddress, setHasHydratedAddress] = useState(false);
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
  const [termsError, setTermsError] = useState(false);
  const [hasUploadedFiles, setHasUploadedFiles] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [invalidBillingFields, setInvalidBillingFields] = useState<Set<string>>(new Set());
  const [invalidDeliveryFields, setInvalidDeliveryFields] = useState<Set<string>>(new Set());
  const shippingCost = calculateDpdCourierShippingGross({
    deliveryMethod,
    productsSubtotal: cart.totals.subtotal,
    courierPrice: normalizeCourierPrice(dpdCourierPrice),
    freeShippingFrom: normalizeFreeShippingFrom(dpdCourierFreeFrom),
  });
  const shippingVatAmount = splitGrossByVat(shippingCost, normalizeVatRate(shopVatRate)).vat;
  const orderVatWithShipping = cart.totals.vatAmount + shippingVatAmount;
  const orderTotalWithShipping = cart.totals.total + shippingCost;

  useEffect(() => {
    if (hasTrackedBeginCheckoutRef.current) return;

    const items = cart.items.map((item) => ({
      item_id: buildMarketingItemId(item.product.id, item.product.wpProductId ?? null),
      item_name: item.product.name,
      price: item.priceSnapshot?.gross ?? 0,
      quantity: item.quantity,
    }));

    if (items.length === 0) return;

    trackDataLayerEvent("begin_checkout", {
      currency: "EUR",
      value: cart.totals.subtotal,
      items,
    });
    hasTrackedBeginCheckoutRef.current = true;
  }, [cart.items, cart.totals.subtotal]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/shop-settings", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        const methods: PaymentMethod[] = [];
        if (data?.paymentSettings?.bankTransferEnabled) methods.push("bank");
        if (data?.paymentSettings?.cardEnabled) methods.push("stripe");
        const codAllowed =
          data?.paymentSettings?.codEnabled &&
          ((deliveryMethod === "DPD_PICKUP" && data?.paymentSettings?.codForPickup) ||
            (deliveryMethod === "DPD_COURIER" && data?.paymentSettings?.codForCourier));
        if (codAllowed) methods.push("cod");
        if (active && methods.length > 0) {
          setAvailablePaymentMethods(methods);
          if (!methods.includes(paymentMethod)) {
            setPaymentMethod(methods[0]);
          }
        }
        if (active) {
          const rawVatRate = Number(data?.vatRate ?? 0.2);
          const rawCourierPrice = Number(data?.dpdShipping?.courierPrice ?? 4.99);
          const rawCourierFreeFrom = Number(data?.dpdShipping?.courierFreeFrom ?? 100);
          setPickupPointEnabled(
            String(data?.dpdShipping?.pickupPointEnabled ?? "true") !== "false"
          );
          setShopVatRate(normalizeVatRate(rawVatRate));
          setDpdCourierPrice(normalizeCourierPrice(rawCourierPrice));
          setDpdCourierFreeFrom(normalizeFreeShippingFrom(rawCourierFreeFrom));
        }
      } catch {
        // keep defaults
      }
    })();
    return () => {
      active = false;
    };
  }, [deliveryMethod, paymentMethod]);

  useEffect(() => {
    if (!pickupPointEnabled && deliveryMethod === "DPD_PICKUP") {
      setDeliveryMethod("DPD_COURIER");
      setPickupPoint(null);
    }
  }, [pickupPointEnabled, deliveryMethod]);

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
          { number: 2, title: "Dokončenie", description: "Kontrola a platba" },
        ]
      : [
          { number: 1, title: "Prezeranie", description: "Kontrola košíka" },
          {
            number: 2,
            title: "Fakturácia a doručenie",
            description: "Firemné údaje a adresa",
          },
          { number: 3, title: "Dokončenie", description: "Kontrola a platba" },
        ];

  const infoStep = mode === "b2c" ? 1 : 2;
  const reviewStep = mode === "b2c" ? 2 : 3;

  const handleBillingChange = (field: string, value: string) => {
    setBillingData((prev) => ({ ...prev, [field]: value }));
    setInvalidBillingFields((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  };

  const handleDeliveryChange = (field: string, value: string) => {
    setDeliveryData((prev) => ({ ...prev, [field]: value }));
    setInvalidDeliveryFields((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
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

  useEffect(() => {
    if (hasHydratedAddress) return;
    try {
      const stored = localStorage.getItem(addressStorageKey);
      if (!stored) {
        setHasHydratedAddress(true);
        return;
      }
      const parsed = JSON.parse(stored) as CheckoutAddressStorage;
      if (parsed?.billingData) {
        setBillingData((prev) => ({ ...prev, ...parsed.billingData }));
      }
      if (typeof parsed?.deliveryDifferent === "boolean") {
        setDeliveryDifferent(parsed.deliveryDifferent);
      }
      if (parsed?.deliveryData) {
        setDeliveryData((prev) => ({ ...prev, ...parsed.deliveryData }));
      }
      if (parsed?.selectedDeliveryAddressId) {
        setSelectedDeliveryAddressId(parsed.selectedDeliveryAddressId);
      }
      if (
        parsed?.selectedDeliveryMethod === "DPD_COURIER" ||
        parsed?.selectedDeliveryMethod === "DPD_PICKUP" ||
        parsed?.selectedDeliveryMethod === "PERSONAL_PICKUP"
      ) {
        setDeliveryMethod(parsed.selectedDeliveryMethod);
      }
      if (parsed?.selectedPickupPoint) {
        setPickupPoint(parsed.selectedPickupPoint);
      }
    } catch (storageError) {
      console.warn("Checkout address restore failed:", storageError);
    } finally {
      setHasHydratedAddress(true);
    }
  }, [addressStorageKey, hasHydratedAddress]);

  useEffect(() => {
    if (!hasHydratedAddress) return;
    const payload: CheckoutAddressStorage = {
      billingData,
      deliveryData,
      deliveryDifferent,
      selectedDeliveryAddressId,
      selectedDeliveryMethod: deliveryMethod,
      selectedPickupPoint: pickupPoint ?? null,
    };
    try {
      localStorage.setItem(addressStorageKey, JSON.stringify(payload));
    } catch (storageError) {
      console.warn("Checkout address persist failed:", storageError);
    }
  }, [
    addressStorageKey,
    billingData,
    deliveryData,
    deliveryDifferent,
    hasHydratedAddress,
    selectedDeliveryAddressId,
    deliveryMethod,
    pickupPoint,
  ]);

  useEffect(() => {
    const hasPendingFiles = Boolean(
      window.__pendingOrderUpload?.file || window.__pendingDesignPdf?.file
    );
    setHasUploadedFiles(hasPendingFiles);
  }, []);

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
    && deliveryMethod !== "PERSONAL_PICKUP"
    ? deliveryData.firstName.trim() &&
      deliveryData.lastName.trim() &&
      deliveryData.email.trim() &&
      deliveryData.phone.trim() &&
      deliveryData.street.trim() &&
      deliveryData.city.trim() &&
      deliveryData.zipCode.trim() &&
      deliveryData.country.trim()
      : true;

  useEffect(() => {
    if (deliveryMethod === "PERSONAL_PICKUP") {
      setDeliveryDifferent(false);
      setPickupPoint(null);
    }
  }, [deliveryMethod]);

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
      deliveryMethod,
      paymentMethod: toCheckoutPaymentMethod(paymentMethod),
      pickupPoint: pickupPoint ?? undefined,
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
    const itemMappings = Array.isArray(order?.itemMappings)
      ? (order.itemMappings as Array<{ cartItemId: string; orderItemId: string }>)
      : [];
    const resolveOrderItemId = (cartItemId?: string) =>
      cartItemId
        ? itemMappings.find((mapping) => mapping.cartItemId === cartItemId)?.orderItemId ?? null
        : null;

    const pendingUpload = window.__pendingOrderUpload;
    if (pendingUpload?.file) {
      try {
        const file = pendingUpload.file;
        const orderItemId = resolveOrderItemId(pendingUpload.cartItemId);
        const presignResponse = await fetch("/api/uploads/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getCsrfHeader() },
          body: JSON.stringify({
            orderId: order.id,
            orderItemId,
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

    // Upload Design Studio PDF if present
    const pendingDesignPdf = window.__pendingDesignPdf;
    if (pendingDesignPdf?.file) {
      try {
        const file = pendingDesignPdf.file;
        const orderItemId = resolveOrderItemId(pendingDesignPdf.cartItemId);
        const presignResponse = await fetch("/api/uploads/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getCsrfHeader() },
          body: JSON.stringify({
            orderId: order.id,
            orderItemId,
            kind: "ARTWORK",
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
          }),
        });

        if (presignResponse.ok) {
          const presignData = await presignResponse.json();
          const uploadResponse = await fetch(presignData.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type || "application/pdf" },
            body: file,
          });

          if (uploadResponse.ok) {
            await fetch("/api/uploads/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json", ...getCsrfHeader() },
              body: JSON.stringify({ assetId: presignData.assetId }),
            });
          }
        }
      } catch (designUploadError) {
        console.error("Design PDF upload error:", designUploadError);
        // Don't fail the order — design data is already saved in OrderItem.designData
      } finally {
        delete window.__pendingDesignPdf;
      }
    }

    window.dispatchEvent(new Event("cart-updated"));

    return { orderId: order.id as string, uploadFailed };
  }, [billingData, deliveryData, deliveryDifferent, notes, customerEmail, customerName, customerPhone, deliveryMethod, paymentMethod, pickupPoint]);

  const preparePayment = useCallback(async (methodOverride?: PaymentMethod) => {
    const effectiveMethod = methodOverride ?? paymentMethod;
    if (effectiveMethod !== "stripe") {
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
        headers: { "Content-Type": "application/json", ...getCsrfHeader() },
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

  const clearCartAfterCheckout = useCallback(async () => {
    try {
      await fetch("/api/cart/clear", {
        method: "POST",
        headers: { ...getCsrfHeader() },
      });
    } catch (clearError) {
      console.error("Failed to clear cart after checkout:", clearError);
    } finally {
      window.dispatchEvent(new Event("cart-updated"));
    }
  }, []);

  useEffect(() => {
    if (currentStep !== reviewStep) return;
    if (paymentMethod !== "stripe") return;
    if (clientSecret || orderId || isPreparingPayment) return;
    preparePayment("stripe");
  }, [
    clientSecret,
    currentStep,
    isPreparingPayment,
    orderId,
    paymentMethod,
    preparePayment,
    reviewStep,
  ]);

  const handleOfflinePayment = useCallback(async () => {
    if (isSubmitting || isPreparingPayment) return;
    if (!customerName.trim() || !customerEmail.trim()) {
      setError("Meno a e-mail sú povinné.");
      return;
    }
    if (!acceptedTerms) {
      setTermsError(true);
      setError(
        "Na dokončenie objednávky potvrďte súhlas s obchodnými podmienkami a ochranou osobných údajov."
      );
      const termsCheckbox = document.getElementById("terms");
      termsCheckbox?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setTermsError(false);
    setIsSubmitting(true);
    setError(null);
    try {
      const selectedCheckoutPaymentMethod = toCheckoutPaymentMethod(paymentMethod);
      if (orderId) {
        const syncResponse = await fetch(`/api/orders/${orderId}/payment-method`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...getCsrfHeader() },
          body: JSON.stringify({
            paymentMethod: selectedCheckoutPaymentMethod,
            customerEmail: customerEmail.trim(),
          }),
        });
        if (!syncResponse.ok) {
          const syncError = await syncResponse.json().catch(() => ({}));
          throw new Error(syncError.error ?? "Nepodarilo sa aktualizovať spôsob platby.");
        }
        await clearCartAfterCheckout();
        window.location.href = `/checkout/success?orderId=${orderId}`;
        return;
      }
      const { orderId: createdOrderId, uploadFailed } = await createOrderAndUpload();
      const uploadParam = uploadFailed ? "&upload=failed" : "";
      await clearCartAfterCheckout();
      window.location.href = `/checkout/success?orderId=${createdOrderId}${uploadParam}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Neznáma chyba");
      setIsSubmitting(false);
    }
  }, [
    createOrderAndUpload,
    customerEmail,
    customerName,
    clearCartAfterCheckout,
    paymentMethod,
    acceptedTerms,
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
              invalidFields={invalidBillingFields}
            />

            <Card className="p-6">
              <h3 className="mb-4 text-lg font-semibold">Spôsob doručenia</h3>
              <div className="rounded-lg border bg-muted/20 p-4 text-sm">
                <div className="font-medium">
                  {deliveryMethod === "PERSONAL_PICKUP"
                    ? "Osobný odber - Rozvojová 2, Košice"
                    : deliveryMethod === "DPD_PICKUP"
                      ? "DPD Pickup point"
                      : "DPD kuriér"}
                </div>
                {deliveryMethod === "DPD_PICKUP" && pickupPoint?.parcelShopId ? (
                  <div className="mt-2 text-muted-foreground">
                    {pickupPoint.name}
                    <br />
                    {pickupPoint.street}
                    <br />
                    {pickupPoint.zip} {pickupPoint.city}
                  </div>
                ) : null}
                {deliveryMethod === "DPD_PICKUP" && !pickupPoint?.parcelShopId ? (
                  <div className="mt-2 text-red-600">
                    Vyberte odberné miesto v košíku.
                  </div>
                ) : null}
                <a
                  href="/cart"
                  className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
                >
                  Zmeniť spôsob doručenia v košíku
                </a>
              </div>
            </Card>

            {deliveryMethod !== "PERSONAL_PICKUP" && (
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
            )}

            {deliveryMethod !== "PERSONAL_PICKUP" && deliveryDifferent && hasSavedAddresses && (
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

            {deliveryMethod !== "PERSONAL_PICKUP" && deliveryDifferent && (
              <AddressForm
                mode={mode}
                title={mode === "b2c" ? "Adresa doručenia" : "Adresa dodania"}
                showCompanyFields={false}
                values={deliveryData}
                onChange={handleDeliveryChange}
                invalidFields={invalidDeliveryFields}
              />
            )}
          </>
        )}

        {currentStep === reviewStep && (
          <>
            <OrderReview
              mode={mode}
              items={orderItems}
              hasUploadedFiles={hasUploadedFiles}
              shippingMethod={
                deliveryMethod === "PERSONAL_PICKUP"
                  ? "Osobný odber - Rozvojová 2, Košice"
                  : deliveryMethod === "DPD_PICKUP"
                    ? `DPD Pickup/Pickup Station${pickupPoint?.name ? ` - ${pickupPoint.name}` : ""}`
                    : "DPD kuriér"
              }
              shippingCost={shippingCost}
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
              }}
            />

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

            <Card className="p-6">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="terms"
                  checked={acceptedTerms}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setAcceptedTerms(checked);
                    if (checked) {
                      setTermsError(false);
                    }
                  }}
                  className={`mt-1 h-4 w-4 rounded ${
                    termsError
                      ? "border-destructive ring-2 ring-destructive/30"
                      : "border-border"
                  }`}
                />
                <div>
                  <label
                    htmlFor="terms"
                    className={`text-sm ${termsError ? "text-destructive" : "text-muted-foreground"}`}
                  >
                  Súhlasím s{" "}
                  <a href="/obchodne-podmienky" className="font-medium text-primary hover:underline">
                    obchodnými podmienkami
                  </a>{" "}
                  a{" "}
                  <a href="/ochrana-osobnych-udajov" className="font-medium text-primary hover:underline">
                    ochranou osobných údajov
                  </a>
                  </label>
                  {termsError && (
                    <p className="mt-1 text-xs text-destructive">
                      Potvrďte súhlas pre dokončenie objednávky.
                    </p>
                  )}
                </div>
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
                  const missing = new Set<string>();
                  const requiredBilling: (keyof CheckoutBillingData)[] = [
                    "firstName", "lastName", "email", "phone",
                    "street", "city", "zipCode", "country",
                  ];
                  if (mode === "b2b") {
                    requiredBilling.push("companyName", "ico", "dic");
                  }
                  for (const f of requiredBilling) {
                    if (!billingData[f]?.trim()) missing.add(f);
                  }
                  setInvalidBillingFields(missing);
                  setError("Vyplňte povinné údaje.");
                  return;
                }
                if (currentStep === infoStep && !canProceedFromDelivery) {
                  const missing = new Set<string>();
                  const requiredDelivery = [
                    "firstName", "lastName", "email", "phone",
                    "street", "city", "zipCode", "country",
                  ] as const;
                  for (const f of requiredDelivery) {
                    if (!deliveryData[f]?.trim()) missing.add(f);
                  }
                  setInvalidDeliveryFields(missing);
                  setError("Vyplňte adresu doručenia.");
                  return;
                }
                if (currentStep === infoStep && deliveryMethod === "DPD_PICKUP" && !pickupPoint?.parcelShopId) {
                  setError("Vyberte odberné miesto DPD.");
                  return;
                }
                setError(null);
                setInvalidBillingFields(new Set());
                setInvalidDeliveryFields(new Set());
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
                <span className="text-muted-foreground">Doprava:</span>
                {shippingCost === 0 ? (
                  <span className="font-medium text-green-600">Zdarma</span>
                ) : (
                  <PriceDisplay price={shippingCost} mode={mode} size="sm" />
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">DPH:</span>
                <span>{formatPrice(orderVatWithShipping)}</span>
              </div>
              <div className="border-t border-border pt-2">
                <div className="flex justify-between text-lg font-bold">
                  <span>Celkom:</span>
                  {mode === "b2c" ? (
                    <PriceDisplay price={orderTotalWithShipping} mode={mode} size="lg" />
                  ) : (
                    <span>{formatPrice(orderTotalWithShipping)}</span>
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
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Platba</h3>
                <PaymentMethodSelector
                  mode={mode}
                  selected={paymentMethod}
                  allowedMethods={availablePaymentMethods}
                  variant="embedded"
                  onSelect={(next) => {
                    setPaymentMethod(next);
                    if (next === "stripe") {
                      preparePayment(next);
                    }
                  }}
                />

                {paymentMethod === "stripe" && (
                  <div className="rounded-lg border border-border p-4">
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
                  </div>
                )}

                {(paymentMethod === "bank" || paymentMethod === "cod") && (
                  <div className="space-y-3">
                    <ModeButton
                      mode={mode}
                      variant="primary"
                      size="lg"
                      type="button"
                      className="w-full"
                      onClick={handleOfflinePayment}
                      disabled={isSubmitting || isPreparingPayment}
                    >
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Potvrdiť objednávku
                    </ModeButton>
                    <p className="text-center text-xs text-muted-foreground">
                      {paymentMethod === "cod"
                        ? "Objednávka bude pripravená na dobierku."
                        : "Pokyny k platbe uvidíte po vytvorení objednávky."}
                    </p>
                  </div>
                )}

                {paymentMethod === "stripe" && (
                  <>
                    {!clientSecret && (
                      <div className="text-sm text-muted-foreground">
                        Pripravujeme platobný formulár...
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
                            customerEmail={customerEmail}
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
              </div>
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
                <span className="text-muted-foreground">Kontrola súborov v cene</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
      </div>
    </div>
  );
}
