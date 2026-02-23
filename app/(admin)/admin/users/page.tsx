import { Suspense } from "react";

import { requireAdmin } from "@/lib/auth-helpers";
import { getPrisma } from "@/lib/prisma";
import { UserRole } from "@/lib/generated/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminButton } from "@/components/admin/admin-button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { FormSubmitButton } from "@/components/admin/form-submit-button";
import { ConfirmDeleteForm } from "@/components/admin/confirm-delete-form";
import { createUserByAdmin, deleteUserByAdmin } from "./actions";
import { UserRoleToggle } from "./user-role-toggle";

type UsersSearchParams = {
  q?: string | string[];
  role?: string | string[];
  created?: string | string[];
  createError?: string | string[];
  deleted?: string | string[];
  deleteError?: string | string[];
};

const normalizeString = (value?: string | string[]) => {
  if (!value) return "";
  if (Array.isArray(value)) return value[0] ?? "";
  return value;
};

export default function UsersPage({
  searchParams,
}: {
  searchParams?: Promise<UsersSearchParams>;
}) {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <div className="mb-6 space-y-2">
            <div className="h-7 w-40 rounded bg-muted" />
            <div className="h-4 w-72 rounded bg-muted" />
          </div>
          <div className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
            Načítavame používateľov…
          </div>
        </div>
      }
    >
      <UsersContent searchParamsPromise={searchParams} />
    </Suspense>
  );
}

async function UsersContent({
  searchParamsPromise,
}: {
  searchParamsPromise?: Promise<UsersSearchParams>;
}) {
  const session = await requireAdmin();
  const resolved = searchParamsPromise ? await searchParamsPromise : {};

  const q = normalizeString(resolved.q).trim();
  const role = normalizeString(resolved.role).trim();
  const created = normalizeString(resolved.created).trim();
  const createError = normalizeString(resolved.createError).trim();
  const deleted = normalizeString(resolved.deleted).trim();
  const deleteError = normalizeString(resolved.deleteError).trim();

  const prisma = getPrisma();
  const users = await prisma.user.findMany({
    where: {
      ...(role === "ADMIN" || role === "USER" ? { role: role as UserRole } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      image: true,
      emailVerified: true,
      createdAt: true,
      _count: {
        select: {
          sessions: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Používatelia</h1>
        <p className="mt-2 text-muted-foreground">Správa používateľov a prístupových práv</p>
      </div>

      {created === "1" ? (
        <div className="rounded-md border border-emerald-400/40 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Používateľ bol úspešne vytvorený.
        </div>
      ) : null}
      {deleted === "1" ? (
        <div className="rounded-md border border-emerald-400/40 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Používateľ bol odstránený.
        </div>
      ) : null}
      {createError === "exists" ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Používateľ s týmto e-mailom už existuje.
        </div>
      ) : null}
      {createError === "invalid" ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Skontrolujte zadané údaje pre nového používateľa.
        </div>
      ) : null}
      {deleteError === "self" ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Nemôžete odstrániť vlastný účet.
        </div>
      ) : null}
      {deleteError === "lastAdmin" ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Nemožno odstrániť posledného administrátora.
        </div>
      ) : null}
      {deleteError === "related" ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Používateľa nemožno odstrániť, pretože je naviazaný na dáta v systéme.
        </div>
      ) : null}
      {deleteError === "notfound" ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Používateľ už neexistuje.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Vytvoriť používateľa</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createUserByAdmin} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_160px_auto] md:items-end">
            <div className="space-y-1">
              <label htmlFor="new-user-name" className="text-sm font-medium">
                Meno
              </label>
              <Input id="new-user-name" name="name" placeholder="Meno používateľa" required minLength={2} />
            </div>
            <div className="space-y-1">
              <label htmlFor="new-user-email" className="text-sm font-medium">
                E-mail
              </label>
              <Input id="new-user-email" name="email" type="email" placeholder="meno@firma.sk" required />
            </div>
            <div className="space-y-1">
              <label htmlFor="new-user-password" className="text-sm font-medium">
                Heslo
              </label>
              <Input id="new-user-password" name="password" type="password" placeholder="Min. 6 znakov" required minLength={6} />
            </div>
            <div className="space-y-1">
              <label htmlFor="new-user-role" className="text-sm font-medium">
                Rola
              </label>
              <select
                id="new-user-role"
                name="role"
                defaultValue="USER"
                className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
              >
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
            <FormSubmitButton size="sm">Vytvoriť</FormSubmitButton>
          </form>
        </CardContent>
      </Card>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="space-y-1">
          <label htmlFor="q" className="text-sm font-medium">
            Vyhľadávanie
          </label>
          <Input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Meno alebo e-mail"
            className="w-80"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="role" className="text-sm font-medium">
            Rola
          </label>
          <select
            id="role"
            name="role"
            defaultValue={role || "all"}
            className="h-9 rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="all">Všetky roly</option>
            <option value="ADMIN">ADMIN</option>
            <option value="USER">USER</option>
          </select>
        </div>
        <AdminButton type="submit" size="sm">
          Filtrovať
        </AdminButton>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Zoznam používateľov ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Žiadni používatelia</div>
          ) : (
            <div className="table-responsive rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-3 py-2">Používateľ</th>
                    <th className="px-3 py-2">Registrácia</th>
                    <th className="px-3 py-2">Relácie</th>
                    <th className="px-3 py-2">Rola</th>
                    <th className="px-3 py-2 text-right">Akcie</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b last:border-b-0">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            {user.image ? <AvatarImage src={user.image} alt={user.name || user.email} /> : null}
                            <AvatarFallback>
                              {(user.name || user.email).slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{user.name || user.email}</div>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString("sk-SK")}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{user._count.sessions}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={user.role === UserRole.ADMIN ? "default" : "secondary"}>
                            {user.role}
                          </Badge>
                          {user.emailVerified ? (
                            <Badge variant="outline" className="border-green-600 text-green-600">
                              Overený
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <AdminButton asChild size="sm" variant="outline">
                            <Link href={`/admin/users/${user.id}`}>Detail</Link>
                          </AdminButton>
                          <UserRoleToggle
                            userId={user.id}
                            currentRole={user.role}
                            isSelf={session.user.id === user.id}
                          />
                          {session.user.id !== user.id ? (
                            <ConfirmDeleteForm
                              action={deleteUserByAdmin.bind(null, { userId: user.id })}
                              triggerText="Odstrániť"
                              title="Odstrániť používateľa?"
                              description={`Používateľ ${user.email} bude odstránený natrvalo.`}
                            />
                          ) : null}
                        </div>
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
