"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Bot,
  ClipboardList,
  Command,
  Cpu,
  FolderKanban,
  LayoutDashboard,
  LibraryBig,
  MessageSquareText,
  Settings
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { getStoredTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "总控台", icon: LayoutDashboard },
  { href: "/agents", label: "员工", icon: Bot },
  { href: "/projects", label: "项目", icon: FolderKanban },
  { href: "/tasks", label: "任务", icon: ClipboardList },
  { href: "/models", label: "模型", icon: Cpu },
  { href: "/skills", label: "技能", icon: LibraryBig },
  { href: "/command-center", label: "指挥台", icon: Command },
  { href: "/meeting-room", label: "会议室", icon: MessageSquareText },
  { href: "/memory", label: "记忆库", icon: BookOpen },
  { href: "/setup", label: "设置", icon: Settings }
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    const theme = getStoredTheme();
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, []);

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
              <span className="mt-1 block text-sm text-moss">数字员工工作台</span>
            </span>
          </Link>

          <div className="mt-6 px-2">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-moss/80">创始人系统</p>
            <p className="mt-2 text-sm leading-6 text-moss">像管理一支高配远程团队一样，统一管理你的 AI 员工、项目、技能与决策流程。</p>
          </div>

          <nav className="mt-6 flex-1 space-y-2 pb-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

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
          </nav>

          <div className="glass-panel mt-4 rounded-[24px] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink">界面主题</p>
                <p className="mt-1 text-xs leading-5 text-moss">浅色更通透，深色更适合长时间盯盘与夜间工作。</p>
              </div>
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
                <p className="mt-1 text-xs leading-5 text-moss">数字员工工作台</p>
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
