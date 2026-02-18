"use client";

import { BottomNav } from "@/components/ui/bottom-nav";
import { SidebarNav } from "@/components/ui/sidebar-nav";
import { navItems } from "./nav-items";

/** 响应式导航：移动端显示底部栏，桌面端显示侧边栏 */
export default function AppNav() {
  return (
    <>
      <BottomNav items={navItems} />
      <SidebarNav items={navItems} />
    </>
  );
}
