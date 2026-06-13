"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Bot, ClipboardList, Command, Cpu, FolderKanban, LayoutDashboard, MessageSquareText, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/models", label: "Models", icon: Cpu },
  { href: "/command-center", label: "Command Center", icon: Command },
  { href: "/meeting-room", label: "Meeting Room", icon: MessageSquareText },
  { href: "/memory", label: "Memory", icon: BookOpen },
  { href: "/setup", label: "Setup", icon: Settings }
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-paper">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r border-line bg-[#fbfcf8] px-4 py-5 lg:block">
        <Link href="/" className="flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="flex h-12 w-28 items-center justify-center overflow-hidden rounded-md border border-line bg-white px-2">
            <Image src="/zlink-logo.jpg" alt="ZLink" width={112} height={48} className="h-full w-full object-contain" priority />
          </span>
          <span>
            <span className="block text-sm font-semibold text-ink">ZLink AI</span>
            <span className="block text-xs text-moss">数字员工工作台</span>
          </span>
        </Link>
        <nav className="mt-8 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-moss transition",
                  active && "bg-mint text-ink",
                  !active && "hover:bg-[#e8efe4] hover:text-ink"
                )}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-10 border-b border-line bg-paper/92 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-moss">Owner Console</p>
              <h1 className="text-lg font-semibold text-ink">ZLink AI 数字员工工作台</h1>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-line bg-[#fbfcf8] px-3 py-2 text-sm text-moss">
              <span className="h-2 w-2 rounded-full bg-amber" />
              真实模式优先
            </div>
          </div>
          <nav className="flex gap-2 overflow-x-auto border-t border-line px-4 py-2 lg:hidden">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-moss",
                    active && "bg-mint text-ink"
                  )}
                >
                  <Icon size={15} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
