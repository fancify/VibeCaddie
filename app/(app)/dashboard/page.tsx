"use client";

import { useEffect, useState } from "react";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentRounds } from "@/components/dashboard/recent-rounds";


interface DashboardData {
  profile: { name: string } | null;
  recent_rounds: Array<{
    id: string;
    course_name: string;
    tee_name: string;
    played_date: string;
    total_score: number | null;
    fw_count: number;
    insight?: string;
  }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/dashboard");
        if (res.ok) {
          const json = (await res.json()) as DashboardData;
          setData(json);
        } else {
          setError("Couldn't load your dashboard right now.");
        }
      } catch {
        setError("Something went wrong. Give it another try.");
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

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-secondary text-[0.9375rem]">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-accent text-[0.9375rem] font-medium hover:underline cursor-pointer"
        >
          Retry
        </button>
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

    </div>
  );
}
