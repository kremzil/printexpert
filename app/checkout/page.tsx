import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCart } from "@/lib/cart";
import { CheckoutForm } from "@/components/cart/checkout-form";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveAudienceContext } from "@/lib/audience-context";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";

export const metadata = {
  title: "Pokladňa",
  description: "Dokončenie objednávky",
};

async function CheckoutContent({ mode }: { mode: "b2b" | "b2c" }) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("cart_session_id")?.value;
  const cart = await getCart(sessionId);

  if (!cart || cart.items.length === 0) {
    redirect("/cart");
  }

  // Serialize Decimal values for client component
  const serializedCart = {
    ...cart,
    items: cart.items.map((item) => ({
      ...item,
      width: item.width ? Number(item.width) : null,
      height: item.height ? Number(item.height) : null,
    })),
  };

  const session = await auth();
  const prisma = getPrisma();
  let initialBillingData: {
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
  } | null = null;
  let savedAddresses: Array<{
    id: string;
    label: string;
    street: string;
    apt: string | null;
    city: string;
    zipCode: string;
    country: string;
    isDefault: boolean;
  }> = [];

  if (session?.user?.id) {
    const splitFullName = (fullName?: string | null) => {
      const normalized = (fullName ?? "").trim();
      if (!normalized) {
        return { firstName: "", lastName: "" };
      }
      const parts = normalized.split(/\s+/);
      const [firstName, ...rest] = parts;
      return { firstName, lastName: rest.join(" ") };
    };

    const [user, companyProfile, addresses] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, email: true },
      }),
      prisma.companyProfile.findUnique({
        where: { userId: session.user.id },
      }),
      prisma.userAddress.findMany({
        where: { userId: session.user.id },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        select: {
          id: true,
          label: true,
          street: true,
          apt: true,
          city: true,
          zipCode: true,
          country: true,
          isDefault: true,
        },
      }),
    ]);

    const { firstName, lastName } = splitFullName(
      user?.name ?? session.user.name
    );
    const defaultAddress = addresses.find((address) => address.isDefault) ?? addresses[0];

    initialBillingData = {
      companyName: companyProfile?.companyName ?? "",
      ico: companyProfile?.ico ?? "",
      dic: companyProfile?.dic ?? "",
      icDph: companyProfile?.icDph ?? "",
      firstName,
      lastName,
      email: user?.email ?? session.user.email ?? "",
      phone: "",
      street: defaultAddress?.street ?? "",
      apt: defaultAddress?.apt ?? "",
      city: defaultAddress?.city ?? "",
      zipCode: defaultAddress?.zipCode ?? "",
      country: defaultAddress?.country ?? "SK",
    };

    savedAddresses = addresses;
  }

  return (
    <CheckoutForm
      cart={serializedCart}
      mode={mode}
      initialBillingData={initialBillingData}
      savedAddresses={savedAddresses}
    />
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full">
          <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-4">
            <Skeleton className="h-14 w-64" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          </div>
        </div>
      }
    >
      <CheckoutShell />
    </Suspense>
  );
}

async function CheckoutShell() {
  const audienceContext = await resolveAudienceContext({});
  const mode = audienceContext.audience === "b2b" ? "b2b" : "b2c";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-col gap-4">
          <Link
            href="/cart"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Späť do košíka
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-3xl font-bold">Pokladňa</h2>
              <p className="text-sm text-muted-foreground">
                Bezpečný checkout s potvrdením objednávky.
              </p>
            </div>
          </div>
        </div>
        <CheckoutContent mode={mode} />
      </div>
    </div>
  );
}
