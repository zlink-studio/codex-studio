import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "一人公司 AI 数字员工工作台",
  description: "面向一人公司的 AI Agent 管理、任务指挥、会议和知识库工作台。"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
