import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth-helpers";
import { getPrisma } from "@/lib/prisma";
import { UserRole } from "@/lib/generated/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AdminButton } from "@/components/admin/admin-button";
import { FormSubmitButton } from "@/components/admin/form-submit-button";
import { updateUserByAdmin } from "../actions";

type UserDetailSearchParams = {
  updated?: string | string[];
  editError?: string | string[];
};

const normalizeString = (value?: string | string[]) => {
  if (!value) return "";
  if (Array.isArray(value)) return value[0] ?? "";
  return value;
};

const formatDate = (value: Date | null) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("sk-SK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const errorMessages: Record<string, string> = {
  invalid: "Skontrolujte zadané údaje používateľa.",
  exists: "Používateľ s týmto e-mailom už existuje.",
  selfRole: "Nemôžete zmeniť vlastnú rolu na tejto stránke.",
  lastAdmin: "Nemožno odobrať práva poslednému administrátorovi.",
  companyNameRequired: "Ak vyplníte firemné údaje, názov spoločnosti je povinný.",
  password: "Nové heslo musí mať aspoň 6 znakov.",
  unknown: "Ukladanie zlyhalo. Skúste to znova.",
};

export default async function AdminUserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams?: Promise<UserDetailSearchParams>;
}) {
  await requireAdmin();
  const { userId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const updated = normalizeString(resolvedSearchParams.updated);
  const editError = normalizeString(resolvedSearchParams.editError);

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      image: true,
      emailVerified: true,
      passwordHash: true,
      passwordMigrated: true,
      stripeCustomerId: true,
      createdAt: true,
      updatedAt: true,
      companyProfile: {
        select: {
          companyName: true,
          ico: true,
          dic: true,
          icDph: true,
          updatedAt: true,
        },
      },
      addresses: {
        select: {
          id: true,
          label: true,
          street: true,
          apt: true,
          city: true,
          zipCode: true,
          country: true,
          isDefault: true,
          updatedAt: true,
        },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      },
      orders: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          total: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      _count: {
        select: {
          sessions: true,
          orders: true,
          addresses: true,
          orderAssets: true,
        },
      },
    },
  });

  if (!user) {
    notFound();
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Používateľ</h1>
          <p className="mt-2 text-muted-foreground">{user.email}</p>
        </div>
        <AdminButton asChild variant="outline" size="sm">
          <Link href="/admin/users">Späť na používateľov</Link>
        </AdminButton>
      </div>

      {updated === "1" ? (
        <div className="rounded-md border border-emerald-400/40 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Údaje používateľa boli uložené.
        </div>
      ) : null}
      {editError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {errorMessages[editError] ?? "Uloženie zlyhalo."}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Upraviť používateľa</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateUserByAdmin} className="space-y-5">
              <input type="hidden" name="userId" value={user.id} />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="name" className="text-sm font-medium">
                    Meno
                  </label>
                  <Input id="name" name="name" defaultValue={user.name ?? ""} required minLength={2} />
                </div>
                <div className="space-y-1">
                  <label htmlFor="email" className="text-sm font-medium">
                    E-mail
                  </label>
                  <Input id="email" name="email" type="email" defaultValue={user.email} required />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <label htmlFor="role" className="text-sm font-medium">
                    Rola
                  </label>
                  <select
                    id="role"
                    name="role"
                    defaultValue={user.role}
                    className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
                  >
                    <option value={UserRole.USER}>USER</option>
                    <option value={UserRole.ADMIN}>ADMIN</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="stripeCustomerId" className="text-sm font-medium">
                    Stripe Customer ID
                  </label>
                  <Input
                    id="stripeCustomerId"
                    name="stripeCustomerId"
                    defaultValue={user.stripeCustomerId ?? ""}
                    placeholder="cus_..."
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="image" className="text-sm font-medium">
                    URL avatara
                  </label>
                  <Input
                    id="image"
                    name="image"
                    defaultValue={user.image ?? ""}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="newPassword" className="text-sm font-medium">
                    Nové heslo
                  </label>
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    placeholder="Nechať prázdne, ak nemeníte"
                  />
                </div>
                <div className="grid gap-2 rounded-md border bg-muted/20 px-3 py-2">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="hidden" name="emailVerified" value="0" />
                    <input
                      type="checkbox"
                      name="emailVerified"
                      value="1"
                      defaultChecked={Boolean(user.emailVerified)}
                    />
                    <span>E-mail overený</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="hidden" name="passwordMigrated" value="0" />
                    <input
                      type="checkbox"
                      name="passwordMigrated"
                      value="1"
                      defaultChecked={user.passwordMigrated}
                    />
                    <span>Heslo migrované</span>
                  </label>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-medium">Firemný profil</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <label htmlFor="companyName" className="text-sm font-medium">
                      Názov spoločnosti
                    </label>
                    <Input
                      id="companyName"
                      name="companyName"
                      defaultValue={user.companyProfile?.companyName ?? ""}
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="ico" className="text-sm font-medium">
                      IČO
                    </label>
                    <Input id="ico" name="ico" defaultValue={user.companyProfile?.ico ?? ""} />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="dic" className="text-sm font-medium">
                      DIČ
                    </label>
                    <Input id="dic" name="dic" defaultValue={user.companyProfile?.dic ?? ""} />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="icDph" className="text-sm font-medium">
                      IČ DPH
                    </label>
                    <Input id="icDph" name="icDph" defaultValue={user.companyProfile?.icDph ?? ""} />
                  </div>
                </div>
              </div>

              <FormSubmitButton pendingText="Ukladám zmeny...">Uložiť zmeny</FormSubmitButton>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Súhrn účtu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">ID</span>
              <span className="max-w-[180px] truncate" title={user.id}>
                {user.id}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Rola</span>
              <Badge variant={user.role === UserRole.ADMIN ? "default" : "secondary"}>{user.role}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Registrovaný</span>
              <span>{formatDate(user.createdAt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Posledná zmena</span>
              <span>{formatDate(user.updatedAt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Overenie e-mailu</span>
              <span>{formatDate(user.emailVerified)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Heslo nastavené</span>
              <span>{user.passwordHash ? "Áno" : "Nie"}</span>
            </div>
            <div className="border-t pt-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Relácie</span>
                <span>{user._count.sessions}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Objednávky</span>
                <span>{user._count.orders}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Adresy</span>
                <span>{user._count.addresses}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Súbory</span>
                <span>{user._count.orderAssets}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Adresy používateľa</CardTitle>
        </CardHeader>
        <CardContent>
          {user.addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Používateľ nemá uložené žiadne adresy.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {user.addresses.map((address) => (
                <div key={address.id} className="rounded-md border p-3 text-sm">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="font-medium">{address.label}</p>
                    {address.isDefault ? <Badge variant="outline">Predvolená</Badge> : null}
                  </div>
                  <p>{address.street}{address.apt ? `, ${address.apt}` : ""}</p>
                  <p>{address.zipCode} {address.city}</p>
                  <p>{address.country}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Aktualizované: {formatDate(address.updatedAt)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Posledné objednávky</CardTitle>
        </CardHeader>
        <CardContent>
          {user.orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Používateľ zatiaľ nemá žiadne objednávky.</p>
          ) : (
            <div className="table-responsive rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-3 py-2">Objednávka</th>
                    <th className="px-3 py-2">Stav</th>
                    <th className="px-3 py-2">Platba</th>
                    <th className="px-3 py-2">Suma</th>
                    <th className="px-3 py-2">Vytvorená</th>
                    <th className="px-3 py-2 text-right">Akcie</th>
                  </tr>
                </thead>
                <tbody>
                  {user.orders.map((order) => (
                    <tr key={order.id} className="border-b last:border-b-0">
                      <td className="px-3 py-2 font-medium">#{order.orderNumber}</td>
                      <td className="px-3 py-2">{order.status}</td>
                      <td className="px-3 py-2">{order.paymentStatus}</td>
                      <td className="px-3 py-2">{Number(order.total).toFixed(2)} €</td>
                      <td className="px-3 py-2 text-muted-foreground">{formatDate(order.createdAt)}</td>
                      <td className="px-3 py-2 text-right">
                        <AdminButton asChild variant="outline" size="sm">
                          <Link href={`/admin/orders/${order.id}`}>Detail</Link>
                        </AdminButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

