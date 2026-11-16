"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Bot,
  BrainCircuit,
  CalendarDays,
  ChevronRight,
  CircleDot,
  Command,
  Inbox,
  LayoutDashboard,
  Search,
  Settings,
  SlidersHorizontal,
  SquareTerminal,
  UsersRound,
  Workflow
} from "lucide-react";
import { cn } from "@/lib/utils";

const primaryNav = [
  { href: "/", label: "今日总览", icon: LayoutDashboard },
  { href: "/console", label: "Claude 控制台", icon: SquareTerminal },
  { href: "/clients", label: "客户", icon: UsersRound },
  { href: "/operations", label: "服务运营", icon: Workflow },
  { href: "/calendar", label: "运营日历", icon: CalendarDays },
  { href: "/inbox", label: "Owner Inbox", icon: Inbox }
];

const intelligenceNav = [
  { href: "/agents", label: "Agent 团队", icon: Bot },
  { href: "/memory", label: "公司大脑", icon: BrainCircuit },
  { href: "/tasks", label: "执行队列", icon: CircleDot },
  { href: "/projects", label: "项目空间", icon: Command }
];

const systemNav = [
  { href: "/content", label: "内容中心", icon: SlidersHorizontal },
  { href: "/setup", label: "系统连接", icon: Settings }
];

const navItems = [...primaryNav, ...intelligenceNav, ...systemNav];

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(href));
}

function crumbFor(pathname: string) {
  return navItems.find((item) => isActive(pathname, item.href))?.label ?? "ZLink Studio OS";
}

function NavGroup({ label, items, pathname }: { label: string; items: typeof primaryNav; pathname: string }) {
  return (
    <div className="mt-6">
      <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-moss/45">{label}</p>
      <nav className="mt-2 grid gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex h-10 items-center gap-3 rounded-lg border px-3 text-[13px] font-medium transition",
                active
                  ? "border-white/[0.06] bg-white/[0.055] text-ink"
                  : "border-transparent text-moss hover:bg-white/[0.035] hover:text-ink"
              )}
            >
              <Icon size={17} className={cn("text-moss/60 transition", active && "text-[#aaa8ff]")} />
              <span>{item.label}</span>
              {active ? <ChevronRight size={13} className="ml-auto text-moss/50" /> : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") return <>{children}</>;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-[#0b0c0e]/95 px-3.5 py-4 lg:flex lg:flex-col">
        <Link href="/" className="flex items-center gap-3 px-2 py-1">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#e9e5dd] text-[11px] font-bold tracking-tight text-[#19191c]">ZL</span>
          <span>
            <strong className="block text-[13px] font-semibold tracking-tight">ZLink Studio</strong>
            <small className="block font-mono text-[9px] uppercase tracking-[0.16em] text-moss/45">Autonomous OS</small>
          </span>
        </Link>

        <div className="min-h-0 flex-1 overflow-y-auto pb-5">
          <NavGroup label="Workspace" items={primaryNav} pathname={pathname} />
          <NavGroup label="Intelligence" items={intelligenceNav} pathname={pathname} />
          <NavGroup label="System" items={systemNav} pathname={pathname} />
        </div>

        <div className="rounded-xl border border-line bg-white/[0.018] p-3">
          <div className="flex items-center justify-between text-[10px] text-moss">
            <span>系统运行状态</span>
            <span className="inline-flex items-center gap-1.5 text-[#9fd9be]"><i className="h-1.5 w-1.5 rounded-full bg-[#49c98d] shadow-[0_0_10px_#49c98d]" />在线</span>
          </div>
          <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-white/[0.06]"><i className="block h-full w-[92%] bg-gradient-to-r from-[#5e6ad2] to-[#8c87ff]" /></div>
          <p className="mt-3 text-[9px] leading-4 text-moss/50">Agent 与 Supabase 已连接<br />外部动作受审批门保护</p>
        </div>

        <div className="mt-3 flex items-center gap-2.5 px-2 py-1.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-white/[0.035] text-[10px] text-moss">H</span>
          <span className="min-w-0 flex-1"><strong className="block truncate text-[11px] font-medium">Hao · Owner</strong><small className="block text-[9px] text-moss/45">ZLink Studio</small></span>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-20 flex h-[58px] items-center gap-4 border-b border-line bg-paper/80 px-4 backdrop-blur-xl sm:px-6">
          <Link href="/" className="grid h-8 w-8 place-items-center rounded-lg bg-[#e9e5dd] text-[10px] font-bold text-[#19191c] lg:hidden">ZL</Link>
          <span className="hidden text-[11px] text-moss/45 sm:block">Workspace</span>
          <ChevronRight size={13} className="hidden text-moss/30 sm:block" />
          <span className="text-[12px] text-ink/80">{crumbFor(pathname)}</span>
          <div className="ml-auto hidden h-8 w-60 items-center gap-2 rounded-lg border border-line bg-white/[0.02] px-2.5 text-[10px] text-moss/50 md:flex">
            <Search size={14} /> 全局搜索 <kbd className="ml-auto rounded border border-line px-1.5 py-0.5 font-mono text-[8px]">⌘ K</kbd>
          </div>
          <span className="hidden items-center gap-2 text-[10px] text-moss sm:inline-flex"><i className="h-1.5 w-1.5 rounded-full bg-[#49c98d]" />Live</span>
          <button aria-label="通知" className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-white/[0.02] text-moss"><Bell size={14} /></button>
          <Link href="/" className="inline-flex h-8 items-center gap-2 rounded-lg bg-[#e9e5dd] px-3 text-[10px] font-semibold text-[#222125]"><Command size={13} />下达目标</Link>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2 lg:hidden">
          {primaryNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return <Link key={item.href} href={item.href} className={cn("inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[11px]", active ? "bg-white/[0.07] text-ink" : "text-moss")}><Icon size={14} />{item.label}</Link>;
          })}
        </nav>

        <main className="mx-auto max-w-[1680px] px-4 py-7 sm:px-7 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
