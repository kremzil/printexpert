"use client";

import { ReactNode, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, Search } from "lucide-react";

import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminButton } from "@/components/admin/admin-button";
import { AdminCommandPalette } from "@/components/admin/admin-command-palette";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const PAGE_TITLES: Array<{ prefix: string; title: string }> = [
  { prefix: "/admin/products", title: "Produkty" },
  { prefix: "/admin/kolekcie", title: "Kolekcie" },
  { prefix: "/admin/kategorie", title: "Kategórie" },
  { prefix: "/admin/vlastnosti", title: "Vlastnosti" },
  { prefix: "/admin/orders", title: "Objednávky" },
  { prefix: "/admin/users", title: "Používatelia" },
  { prefix: "/admin/top-products", title: "Top produkty" },
  { prefix: "/admin/settings", title: "Nastavenia" },
];

function getPageTitle(pathname: string) {
  if (pathname === "/admin") return "Dashboard";
  const match = PAGE_TITLES.find((entry) => pathname.startsWith(entry.prefix));
  return match?.title ?? "Administrácia";
}

function toLabel(segment: string) {
  if (segment === "admin") return "Admin";
  if (segment === "products") return "Produkty";
  if (segment === "orders") return "Objednávky";
  if (segment === "users") return "Používatelia";
  if (segment === "kategorie") return "Kategórie";
  if (segment === "vlastnosti") return "Vlastnosti";
  if (segment === "kolekcie") return "Kolekcie";
  if (segment === "settings") return "Nastavenia";
  if (segment === "top-products") return "Top produkty";
  return segment;
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const withCommand = event.metaKey || event.ctrlKey;
      if (!withCommand) return;
      if (event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      setPaletteOpen(true);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const breadcrumbs = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    return parts.map((part, index) => {
      const href = `/${parts.slice(0, index + 1).join("/")}`;
      return { href, label: toLabel(part) };
    });
  }, [pathname]);

  return (
    <div className="flex min-h-screen bg-zinc-200 dark:bg-muted/20">
      <aside
        className={`hidden h-screen shrink-0 self-start border-r bg-white lg:sticky lg:top-0 lg:block ${sidebarCollapsed ? "w-20" : "w-72"}`}
      >
        <AdminSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        />
      </aside>

      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" showCloseButton className="p-0">
          <AdminSidebar onNavigate={() => setMobileSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-3 px-4 lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <AdminButton
                variant="ghost"
                size="sm"
                onClick={() => setMobileSidebarOpen(true)}
                className="lg:hidden"
                aria-label="Otvoriť menu"
              >
                <Menu className="h-4 w-4" />
              </AdminButton>

              <div className="min-w-0">
                <div className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
                  {breadcrumbs.map((crumb, index) => (
                    <span key={crumb.href} className="flex items-center gap-1">
                      {index > 0 ? <span>/</span> : null}
                      {index === breadcrumbs.length - 1 ? (
                        <span className="font-medium text-foreground">{crumb.label}</span>
                      ) : (
                        <Link href={crumb.href} className="hover:text-foreground">
                          {crumb.label}
                        </Link>
                      )}
                    </span>
                  ))}
                </div>
                <h1 className="truncate text-lg font-semibold text-gray-900">{getPageTitle(pathname)}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <AdminButton
                variant="outline"
                size="sm"
                onClick={() => setPaletteOpen(true)}
                className="hidden sm:inline-flex"
              >
                <Search className="h-4 w-4" />
                <span>Hľadať</span>
                <span className="rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  Ctrl+K
                </span>
              </AdminButton>
              <AdminButton
                variant="ghost"
                size="sm"
                onClick={() => setPaletteOpen(true)}
                className="sm:hidden"
                aria-label="Hľadať"
              >
                <Search className="h-4 w-4" />
              </AdminButton>
              <AdminButton variant="ghost" size="sm" aria-label="Notifikácie" title="Notifikácie">
                <Bell className="h-4 w-4" />
              </AdminButton>
              <ThemeToggle />
              <AdminButton asChild variant="outline" size="sm">
                <Link href="/admin/settings">Nastavenia</Link>
              </AdminButton>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <AdminCommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
