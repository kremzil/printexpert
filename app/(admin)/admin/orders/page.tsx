import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { AdminOrdersList } from "@/components/admin/admin-orders-list";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminButton } from "@/components/admin/admin-button";
import { Input } from "@/components/ui/input";
import { Prisma } from "@/lib/generated/prisma";

export const dynamic = "force-dynamic";

const orderStatuses = ["PENDING", "CONFIRMED", "PROCESSING", "COMPLETED", "CANCELLED"] as const;
const paymentStatuses = ["UNPAID", "PENDING", "PAID", "FAILED", "REFUNDED"] as const;
const orderStatusLabels: Record<(typeof orderStatuses)[number], string> = {
  PENDING: "Čaká sa",
  CONFIRMED: "Potvrdená",
  PROCESSING: "Spracováva sa",
  COMPLETED: "Dokončená",
  CANCELLED: "Zrušená",
};
const paymentStatusLabels: Record<(typeof paymentStatuses)[number], string> = {
  UNPAID: "Nezaplatená",
  PENDING: "Čaká na platbu",
  PAID: "Zaplatená",
  FAILED: "Neúspešná",
  REFUNDED: "Refundovaná",
};
const sortOptions = [
  { value: "newest", label: "Najnovšie" },
  { value: "oldest", label: "Najstaršie" },
  { value: "status", label: "Status" },
] as const;

type SearchParams = {
  q?: string | string[];
  status?: string | string[];
  paymentStatus?: string | string[];
  from?: string | string[];
  to?: string | string[];
  sort?: string | string[];
};

const normalizeArray = (value?: string | string[]) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap((item) => item.split(","));
  return value.split(",");
};

const normalizeString = (value?: string | string[]) => {
  if (!value) return "";
  if (Array.isArray(value)) return value[0] ?? "";
  return value;
};

const parseDateInput = (value: string, isEnd?: boolean) => {
  if (!value) return null;
  const suffix = isEnd ? "T23:59:59.999Z" : "T00:00:00.000Z";
  const parsed = new Date(`${value}${suffix}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

async function getOrders(searchParams: SearchParams) {
  const selectedStatuses = normalizeArray(searchParams.status).filter((value) =>
    orderStatuses.includes(value as typeof orderStatuses[number])
  ) as Array<(typeof orderStatuses)[number]>;

  const selectedPaymentStatuses = normalizeArray(searchParams.paymentStatus).filter((value) =>
    paymentStatuses.includes(value as typeof paymentStatuses[number])
  ) as Array<(typeof paymentStatuses)[number]>;

  const query = normalizeString(searchParams.q).trim();
  const fromDate = parseDateInput(normalizeString(searchParams.from));
  const toDate = parseDateInput(normalizeString(searchParams.to), true);
  const sort = normalizeString(searchParams.sort) || "newest";

  const where: Prisma.OrderWhereInput = {};

  if (selectedStatuses.length > 0) {
    where.status = { in: selectedStatuses };
  }

  if (selectedPaymentStatuses.length > 0) {
    where.paymentStatus = { in: selectedPaymentStatuses };
  }

  if (fromDate || toDate) {
    where.createdAt = {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate ? { lte: toDate } : {}),
    };
  }

  if (query) {
    where.OR = [
      { orderNumber: { contains: query, mode: "insensitive" } },
      { customerEmail: { contains: query, mode: "insensitive" } },
      { customerName: { contains: query, mode: "insensitive" } },
      { user: { email: { contains: query, mode: "insensitive" } } },
    ];
  }

  const orderBy = (() => {
    if (sort === "oldest") {
      return [{ createdAt: "asc" }] as Prisma.OrderOrderByWithRelationInput[];
    }
    if (sort === "status") {
      return [{ status: "asc" }, { createdAt: "desc" }] as Prisma.OrderOrderByWithRelationInput[];
    }
    return [{ createdAt: "desc" }] as Prisma.OrderOrderByWithRelationInput[];
  })();

  const orders = await prisma.order.findMany({
    where,
    orderBy,
    include: {
      items: true,
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });

  return orders.map(order => ({
    ...order,
    subtotal: Number(order.subtotal),
    vatAmount: Number(order.vatAmount),
    total: Number(order.total),
    codAmount: order.codAmount !== null ? Number(order.codAmount) : null,
    items: order.items.map(item => ({
      ...item,
      width: item.width ? Number(item.width) : null,
      height: item.height ? Number(item.height) : null,
      priceNet: Number(item.priceNet),
      priceVat: Number(item.priceVat),
      priceGross: Number(item.priceGross),
    })),
  }));
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireAdmin();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const orders = await getOrders(resolvedSearchParams);
  const selectedStatuses = normalizeArray(resolvedSearchParams.status).filter((value) =>
    orderStatuses.includes(value as typeof orderStatuses[number])
  );
  const selectedPaymentStatuses = normalizeArray(resolvedSearchParams.paymentStatus).filter((value) =>
    paymentStatuses.includes(value as typeof paymentStatuses[number])
  );
  const query = normalizeString(resolvedSearchParams.q);
  const from = normalizeString(resolvedSearchParams.from);
  const to = normalizeString(resolvedSearchParams.to);
  const sort = normalizeString(resolvedSearchParams.sort) || "newest";

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Objednávky</h1>
        <p className="text-muted-foreground">
          Spravujte všetky objednávky
        </p>
      </div>

      <form className="mb-6 grid gap-4 rounded-lg border bg-card p-4 text-card-foreground shadow-sm" method="get">
        <div className="grid gap-4 lg:grid-cols-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Vyhľadávanie</label>
            <Input
              name="q"
              placeholder="Číslo objednávky, email, meno"
              defaultValue={query}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Status objednávky</label>
            <select
              name="status"
              multiple
              defaultValue={selectedStatuses}
              className="h-24 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {orderStatuses.map((status) => (
                <option key={status} value={status}>
                  {orderStatusLabels[status]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Platba</label>
            <select
              name="paymentStatus"
              multiple
              defaultValue={selectedPaymentStatuses}
              className="h-24 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {paymentStatuses.map((status) => (
                <option key={status} value={status}>
                  {paymentStatusLabels[status]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Od</label>
              <Input type="date" name="from" defaultValue={from} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Do</label>
              <Input type="date" name="to" defaultValue={to} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Triedenie</label>
            <select
              name="sort"
              defaultValue={sort}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <AdminButton type="submit">Filtrovať</AdminButton>
          <AdminButton asChild variant="outline">
            <Link href="/admin/orders">Vyčistiť filtre</Link>
          </AdminButton>
        </div>
      </form>

      <Suspense fallback={<Skeleton className="w-full h-96" />}>
        <AdminOrdersList orders={orders} />
      </Suspense>
    </div>
  );
}
