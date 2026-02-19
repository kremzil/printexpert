"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type CommandItem = {
  id: string;
  label: string;
  sublabel: string;
  href: string;
};

type SearchResponse = {
  products: CommandItem[];
  orders: CommandItem[];
  users: CommandItem[];
};

type AdminCommandPaletteProps = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
};

const EMPTY_RESULT: SearchResponse = {
  products: [],
  orders: [],
  users: [],
};

export function AdminCommandPalette({ open, onOpenChange }: AdminCommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse>(EMPTY_RESULT);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults(EMPTY_RESULT);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults(EMPTY_RESULT);
      setIsLoading(false);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/admin/search?q=${encodeURIComponent(trimmed)}`);
        const data = (await response.json()) as SearchResponse;
        setResults({
          products: data.products ?? [],
          orders: data.orders ?? [],
          users: data.users ?? [],
        });
      } catch {
        setResults(EMPTY_RESULT);
      } finally {
        setIsLoading(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [open, query]);

  const totalResults = useMemo(
    () => results.products.length + results.orders.length + results.users.length,
    [results]
  );

  const handleSelect = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Globálne vyhľadávanie</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Hľadať produkty, objednávky, používateľov…"
              className="pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
            />
          </div>

          <div className="max-h-[56vh] overflow-y-auto rounded-lg border">
            {isLoading ? (
              <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Vyhľadávam…
              </div>
            ) : query.trim().length < 2 ? (
              <div className="px-4 py-6 text-sm text-muted-foreground">
                Zadajte aspoň 2 znaky.
              </div>
            ) : totalResults === 0 ? (
              <div className="px-4 py-6 text-sm text-muted-foreground">
                Nenašli sa žiadne výsledky.
              </div>
            ) : (
              <div className="divide-y">
                <CommandSection title="Produkty" items={results.products} onSelect={handleSelect} />
                <CommandSection title="Objednávky" items={results.orders} onSelect={handleSelect} />
                <CommandSection title="Používatelia" items={results.users} onSelect={handleSelect} />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CommandSection({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: CommandItem[];
  onSelect: (href: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <section className="px-2 py-2">
      <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <button
            key={`${title}-${item.id}`}
            type="button"
            onClick={() => onSelect(item.href)}
            className="w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-muted"
          >
            <div className="text-sm font-medium">{item.label}</div>
            <div className="text-xs text-muted-foreground">{item.sublabel}</div>
          </button>
        ))}
      </div>
    </section>
  );
}

