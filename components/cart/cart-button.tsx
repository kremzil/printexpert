"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function CartButton() {
  const [itemCount, setItemCount] = useState(0);

  useEffect(() => {
    const fetchCart = async () => {
      try {
        const response = await fetch("/api/cart");
        if (response.ok) {
          const cart = await response.json();
          const count = cart.items?.length || 0;
          setItemCount(count);
        }
      } catch (error) {
        console.error("Failed to fetch cart:", error);
      }
    };

    fetchCart();

    // Обновляем при изменении корзины
    const handleCartUpdate = () => fetchCart();
    window.addEventListener("cart-updated", handleCartUpdate);

    return () => {
      window.removeEventListener("cart-updated", handleCartUpdate);
    };
  }, []);

  return (
    <Button asChild variant="ghost" size="icon" className="relative">
      <Link href="/cart" aria-label="Nákupný košík">
        <ShoppingCart className="h-5 w-5" />
        {itemCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
          >
            {itemCount > 9 ? "9+" : itemCount}
          </Badge>
        )}
      </Link>
    </Button>
  );
}
