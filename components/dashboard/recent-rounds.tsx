"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { SectionTitle } from "@/components/ui/section-title";

interface RecentRound {
  id: string;
  course_name: string;
  tee_name: string;
  played_date: string;
  total_score: number | null;
  fw_count: number;
}

interface RecentRoundsProps {
  rounds: RecentRound[];
}

/** 格式化日期为 "Feb 15" 或 "Feb 15, 2025" 风格 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** 最近轮次列表 */
export function RecentRounds({ rounds }: RecentRoundsProps) {
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Recent Rounds</SectionTitle>

      {rounds.length === 0 ? (
        <Card>
          <p className="text-center text-secondary text-[0.9375rem] py-6">
            No rounds yet. Play a round and record it here.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {rounds.map((round) => (
            <Link key={round.id} href={`/rounds/${round.id}`}>
              <Card className="hover:shadow-md transition-shadow duration-150 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[0.9375rem] font-medium text-text">
                      {round.course_name}
                    </p>
                    <p className="text-[0.8125rem] text-secondary">
                      {round.tee_name}
                      {round.tee_name && " · "}
                      {formatDate(round.played_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <span className="text-[0.8125rem] text-secondary">
                      {round.fw_count} FW
                    </span>
                    <span className="text-[1.25rem] font-semibold text-text min-w-[2.5rem] text-right">
                      {round.total_score ?? "—"}
                    </span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
