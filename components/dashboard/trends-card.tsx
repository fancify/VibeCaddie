"use client";

import { Card } from "@/components/ui/card";
import { SectionTitle } from "@/components/ui/section-title";

interface TrendsData {
  total_rounds: number;
  avg_score_last5: number | null;
  fw_rate_last5: number | null;
}

interface TrendsCardProps {
  trends: TrendsData;
}

/** 趋势卡片，至少 2 轮才展示 */
export function TrendsCard({ trends }: TrendsCardProps) {
  if (trends.total_rounds < 2) {
    return null;
  }

  const roundsLabel = trends.total_rounds >= 5 ? "5" : String(trends.total_rounds);

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Your Trends</SectionTitle>

      <Card>
        <div className="flex flex-col gap-3">
          {trends.avg_score_last5 !== null && (
            <div className="flex items-center justify-between">
              <span className="text-[0.9375rem] text-secondary">
                Last {roundsLabel} rounds average
              </span>
              <span className="text-[1.125rem] font-semibold text-text">
                {trends.avg_score_last5}
              </span>
            </div>
          )}

          {trends.fw_rate_last5 !== null && (
            <div className="flex items-center justify-between">
              <span className="text-[0.9375rem] text-secondary">
                Fairway hit rate
              </span>
              <span className="text-[1.125rem] font-semibold text-text">
                {trends.fw_rate_last5}%
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-[0.9375rem] text-secondary">
              Total rounds played
            </span>
            <span className="text-[1.125rem] font-semibold text-text">
              {trends.total_rounds}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
