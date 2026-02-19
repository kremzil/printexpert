"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
  FolderTree,
  Home,
  LayoutDashboard,
  Megaphone,
  Package,
  Settings,
  ShoppingCart,
  Sliders,
  Users,
  ChevronDown,
  ChevronRight,
  PanelLeft,
} from "lucide-react";

import { AdminButton } from "@/components/admin/admin-button";
import { cn } from "@/lib/utils";

type SidebarEntry = {
  id: string;
  title: string;
  url?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children?: Array<{ id: string; title: string; url: string }>;
};

type SidebarGroup = {
  id: string;
  title: string;
  items: SidebarEntry[];
};

const GROUPS: SidebarGroup[] = [
  {
    id: "core",
    title: "Prehľad",
    items: [
      { id: "home", title: "Domov webu", url: "/", icon: Home },
      { id: "dashboard", title: "Dashboard", url: "/admin", icon: LayoutDashboard },
    ],
  },
  {
    id: "catalog",
    title: "Katalóg",
    items: [
      {
        id: "products",
        title: "Produkty",
        icon: Package,
        children: [
          { id: "all-products", title: "Všetky produkty", url: "/admin/products" },
          { id: "collections", title: "Kolekcie", url: "/admin/kolekcie" },
          { id: "categories", title: "Kategórie", url: "/admin/kategorie" },
          { id: "attributes", title: "Vlastnosti", url: "/admin/vlastnosti" },
        ],
      },
    ],
  },
  {
    id: "orders",
    title: "Objednávky",
    items: [{ id: "orders", title: "Objednávky", url: "/admin/orders", icon: ShoppingCart }],
  },
  {
    id: "users",
    title: "Používatelia",
    items: [{ id: "users", title: "Používatelia", url: "/admin/users", icon: Users }],
  },
  {
    id: "promotion",
    title: "Propagácia",
    items: [{ id: "top-products", title: "Top produkty", url: "/admin/top-products", icon: Megaphone }],
  },
  {
    id: "settings",
    title: "Nastavenia",
    items: [{ id: "settings", title: "Nastavenia", url: "/admin/settings", icon: Settings }],
  },
];

type AdminSidebarProps = {
  collapsed?: boolean;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
};

export function AdminSidebar({ collapsed = false, onNavigate, onToggleCollapse }: AdminSidebarProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<string[]>(["products"]);

  const flatChildUrls = useMemo(
    () =>
      GROUPS.flatMap((group) => group.items)
        .flatMap((item) => item.children ?? [])
        .map((child) => child.url),
    []
  );

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => (prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]));
  };

  const isRouteActive = (url?: string) => {
    if (!url) return false;
    if (url === "/admin") return pathname === "/admin";
    return pathname === url || pathname.startsWith(`${url}/`);
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b px-4 py-4">
        <Link href="/admin" className="flex items-center gap-2" onClick={onNavigate}>
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-900 text-sm font-bold text-white">
            P
          </div>
          {!collapsed ? <span className="text-sm font-semibold text-foreground">PrintExpert Admin</span> : null}
        </Link>
        {onToggleCollapse ? (
          <AdminButton
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Rozbaliť menu" : "Zbaliť menu"}
            title={collapsed ? "Rozbaliť menu" : "Zbaliť menu"}
          >
            <PanelLeft className="h-4 w-4" />
          </AdminButton>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <div className="space-y-4">
          {GROUPS.map((group) => (
            <section key={group.id}>
              {!collapsed ? (
                <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.title}
                </div>
              ) : null}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const hasChildren = (item.children?.length ?? 0) > 0;
                  const entryActive =
                    hasChildren && item.children
                      ? item.children.some((child) => isRouteActive(child.url))
                      : isRouteActive(item.url);
                  const entryExpanded = expanded.includes(item.id);
                  const Icon = item.icon ?? Sliders;

                  if (!hasChildren && item.url) {
                    return (
                      <Link
                        key={item.id}
                        href={item.url}
                        onClick={onNavigate}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                          entryActive ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
                        )}
                        title={collapsed ? item.title : undefined}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed ? <span>{item.title}</span> : null}
                      </Link>
                    );
                  }

                  return (
                    <div key={item.id} className="space-y-1">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(item.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                          entryActive ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
                        )}
                        title={collapsed ? item.title : undefined}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed ? <span className="flex-1 text-left">{item.title}</span> : null}
                        {!collapsed ? (
                          entryExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />
                        ) : null}
                      </button>

                      {!collapsed && entryExpanded && item.children ? (
                        <div className="space-y-1 pl-6">
                          {item.children.map((child) => {
                            const childActive = isRouteActive(child.url);
                            return (
                              <Link
                                key={child.id}
                                href={child.url}
                                onClick={onNavigate}
                                className={cn(
                                  "block rounded-md px-2 py-1.5 text-sm transition-colors",
                                  childActive
                                    ? "bg-gray-900 text-white"
                                    : "text-gray-700 hover:bg-gray-100"
                                )}
                              >
                                {child.title}
                              </Link>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </nav>

      <div className="border-t px-4 py-3 text-xs text-muted-foreground">
        {!collapsed ? (
          <div>v2.1.0</div>
        ) : flatChildUrls.includes(pathname) ? (
          <FolderTree className="h-4 w-4" />
        ) : (
          <Settings className="h-4 w-4" />
        )}
      </div>
    </div>
  );
}

