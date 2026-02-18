"use client";

import { useEffect, useState } from "react";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentRounds } from "@/components/dashboard/recent-rounds";
import { TrendsCard } from "@/components/dashboard/trends-card";

interface DashboardData {
  profile: { name: string } | null;
  recent_rounds: Array<{
    id: string;
    course_name: string;
    tee_name: string;
    played_date: string;
    total_score: number | null;
    fw_count: number;
  }>;
  trends: {
    total_rounds: number;
    avg_score_last5: number | null;
    fw_rate_last5: number | null;
  } | null;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/dashboard");
        if (res.ok) {
          const json = (await res.json()) as DashboardData;
          setData(json);
        }
      } catch {
        // 加载失败静默处理
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-secondary text-[0.9375rem]">Loading...</p>
      </div>
    );
  }

  const greeting = data?.profile?.name
    ? `Hey ${data.profile.name}`
    : "Hey there";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[1.875rem] font-semibold text-text">
        {greeting}
      </h1>

      <QuickActions />

      <RecentRounds rounds={data?.recent_rounds ?? []} />

      {data?.trends && <TrendsCard trends={data.trends} />}
    </div>
  );
}
