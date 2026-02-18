"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";

/** 首页快捷操作卡片：新建 Briefing 和 录入新轮次 */
export function QuickActions() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Link href="/briefing">
        <Card className="p-6 bg-accent hover:bg-accent-hover transition-colors duration-150 cursor-pointer">
          <p className="text-[1.125rem] font-semibold text-white">
            New Briefing
          </p>
          <p className="text-[0.875rem] text-white/80 mt-1">
            Prepare for your next round
          </p>
        </Card>
      </Link>

      <Link href="/rounds/new">
        <Card className="p-6 border border-divider hover:shadow-md transition-shadow duration-150 cursor-pointer">
          <p className="text-[1.125rem] font-semibold text-text">
            Enter Round
          </p>
          <p className="text-[0.875rem] text-secondary mt-1">
            Record what happened
          </p>
        </Card>
      </Link>
    </div>
  );
}
