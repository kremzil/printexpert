"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { AdminButton } from "@/components/admin/admin-button";

const STORAGE_KEY = "pe-admin-theme";

type ThemeMode = "light" | "dark";

function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (mode === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "light";
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  });
  useEffect(() => {
    applyTheme(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const toggle = () => {
    const nextMode: ThemeMode = mode === "dark" ? "light" : "dark";
    setMode(nextMode);
  };

  return (
    <AdminButton
      variant="ghost"
      size="sm"
      onClick={toggle}
      aria-label={mode === "dark" ? "Prepnúť na svetlú tému" : "Prepnúť na tmavú tému"}
      title={mode === "dark" ? "Svetlá téma" : "Tmavá téma"}
    >
      {mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </AdminButton>
  );
}
