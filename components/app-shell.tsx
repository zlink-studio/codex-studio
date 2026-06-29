"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Bot,
  ChevronDown,
  ClipboardList,
  Cpu,
  FolderKanban,
  Home,
  LayoutDashboard,
  LibraryBig,
  MessageSquareText,
  Settings,
  SlidersHorizontal
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { getStoredTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const coreNav = [
  { href: "/", label: "公司中枢", icon: Home },
  { href: "/projects", label: "项目", icon: FolderKanban },
  { href: "/tasks", label: "执行队列", icon: ClipboardList }
];

const advancedNav = [
  { href: "/dashboard", label: "数据看板", icon: LayoutDashboard },
  { href: "/agents", label: "数字员工", icon: Bot },
  { href: "/skills", label: "技能", icon: LibraryBig },
  { href: "/models", label: "模型", icon: Cpu },
  { href: "/memory", label: "公司大脑", icon: BookOpen },
  { href: "/meeting-room", label: "会议室", icon: MessageSquareText },
  { href: "/setup", label: "设置", icon: Settings }
];

const navItems = [...coreNav, ...advancedNav];

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(href));
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const advancedActive = advancedNav.some((item) => isActive(pathname, item.href));
  const [advancedOpen, setAdvancedOpen] = useState(advancedActive);

  useEffect(() => {
    const theme = getStoredTheme();
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, []);

  useEffect(() => {
    if (advancedActive) setAdvancedOpen(true);
  }, [advancedActive]);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-[8%] top-[-8%] h-80 w-80 rounded-full bg-white/30 blur-3xl" />
        <div className="absolute bottom-[8%] right-[10%] h-96 w-96 rounded-full bg-mint/25 blur-3xl" />
      </div>

      <aside className="fixed inset-y-4 left-4 z-20 hidden w-[296px] lg:block">
        <div className="glass-panel-strong flex h-full flex-col overflow-y-auto rounded-[28px] px-4 py-4">
          <Link href="/" className="flex items-center gap-4 rounded-[22px] border border-white/35 bg-white/35 px-4 py-4 dark:bg-white/5">
            <span className="flex h-14 w-28 items-center justify-center overflow-hidden rounded-2xl border border-line/70 bg-white/80 px-3 dark:bg-white/10">
              <Image src="/zlink-logo.jpg" alt="ZLink" width={112} height={48} className="h-full w-full object-contain" priority />
            </span>
              <span>
                <span className="block text-lg font-semibold text-ink">ZLink AI</span>
              <span className="mt-1 block text-sm text-moss">一人公司操作系统</span>
              </span>
          </Link>

          <nav className="mt-6 flex-1 space-y-1.5 overflow-y-auto pb-4">
            {coreNav.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-[20px] px-4 py-3 text-sm font-medium transition",
                    active
                      ? "bg-white/75 text-ink shadow-[0_16px_38px_rgba(15,23,42,0.10)] dark:bg-white/10"
                      : "text-moss hover:bg-white/45 hover:text-ink dark:hover:bg-white/8"
                  )}
                >
                  <span className={cn("flex h-9 w-9 items-center justify-center rounded-2xl border border-white/40", active ? "bg-mint/65" : "bg-white/35 dark:bg-white/5")}>
                    <Icon size={18} />
                  </span>
                  {item.label}
                </Link>
              );
            })}

            <div className="pt-3">
              <button
                type="button"
                onClick={() => setAdvancedOpen((value) => !value)}
                aria-expanded={advancedOpen}
                className="flex w-full items-center gap-3 rounded-[20px] px-4 py-3 text-sm font-medium text-moss transition hover:bg-white/45 hover:text-ink dark:hover:bg-white/8"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/40 bg-white/35 dark:bg-white/5">
                  <SlidersHorizontal size={18} />
                </span>
                <span className="flex-1 text-left">系统配置</span>
                <ChevronDown size={16} className={cn("transition-transform", advancedOpen ? "rotate-180" : "rotate-0")} />
              </button>

              {advancedOpen ? (
                <div className="mt-1 space-y-1 border-l border-line/50 pl-3">
                  {advancedNav.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(pathname, item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-[18px] px-3 py-2.5 text-sm transition",
                          active
                            ? "bg-white/70 font-medium text-ink dark:bg-white/10"
                            : "text-moss hover:bg-white/40 hover:text-ink dark:hover:bg-white/8"
                        )}
                      >
                        <Icon size={16} className="shrink-0" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </nav>

          <div className="glass-panel mt-4 rounded-[24px] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">界面主题</p>
              <ThemeToggle compact />
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[328px]">
        <div className="px-3 pt-3 sm:px-4 lg:hidden lg:px-6">
          <div className="glass-panel-strong rounded-[28px] border border-line/70 px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink">ZLink AI</p>
                <p className="mt-1 text-xs leading-5 text-moss">一人公司操作系统</p>
              </div>
              <ThemeToggle compact />
            </div>

            <nav className="mt-4 flex gap-2 overflow-x-auto border-t border-line/60 pt-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition",
                      active
                        ? "border-line/70 bg-white/75 text-ink dark:bg-white/10"
                        : "border-transparent bg-paper/45 text-moss hover:border-line/60"
                    )}
                  >
                    <Icon size={15} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        <main className="px-3 py-3 sm:px-4 lg:px-6 lg:py-4">{children}</main>
      </div>
    </div>
  );
}
