"use client";

import { useEffect, useState } from "react";
import { Moon, SunMedium } from "lucide-react";
import { applyTheme, getStoredTheme, type AppTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const options: Array<{ value: AppTheme; label: string; icon: typeof SunMedium }> = [
  { value: "light", label: "浅色", icon: SunMedium },
  { value: "dark", label: "深色", icon: Moon }
];

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<AppTheme>("light");

  useEffect(() => {
    setTheme(getStoredTheme());
    const onThemeChange = (event: Event) => {
      const next = (event as CustomEvent<AppTheme>).detail;
      setTheme(next);
    };
    const onStorage = () => setTheme(getStoredTheme());
    window.addEventListener("zlink-theme-change", onThemeChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("zlink-theme-change", onThemeChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return (
    <div className={cn("inline-flex items-center rounded-full border border-line/70 bg-paper/55 p-1 shadow-soft backdrop-blur-xl", compact && "gap-1")}>
      {options.map((option) => {
        const Icon = option.icon;
        const active = option.value === theme;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              applyTheme(option.value);
              setTheme(option.value);
            }}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition",
              active ? "bg-white/70 text-ink shadow-[0_10px_24px_rgba(15,23,42,0.10)] dark:bg-white/10" : "text-moss hover:bg-white/40"
            )}
            aria-pressed={active}
            title={`切换到${option.label}`}
          >
            <Icon size={16} />
            {!compact && option.label}
          </button>
        );
      })}
    </div>
  );
}
