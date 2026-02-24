"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import type { RoundHole, CourseHole } from "@/lib/db/types";

/** Tee result 颜色 */
const RESULT_COLOR: Record<string, string> = {
  FW:    "text-green-600",
  LEFT:  "text-amber-600",
  RIGHT: "text-amber-600",
  OB:    "text-red-600",
};

interface RoundSummaryProps {
  holes: RoundHole[];
  courseHoles: CourseHole[];
  /** 如果提供了 onTotalScoreChange，会在计算出总分后调用 */
  onTotalScoreChange?: (totalScore: number) => void;
}

/** 轮次汇总表格 — 显示所有洞的数据和统计 */
export function RoundSummary({
  holes,
  courseHoles,
  onTotalScoreChange,
}: RoundSummaryProps) {
  // 按洞号建立快速查找
  const holeMap = useMemo(() => {
    const map = new Map<number, RoundHole>();
    for (const h of holes) {
      map.set(h.hole_number, h);
    }
    return map;
  }, [holes]);

  const courseHoleMap = useMemo(() => {
    const map = new Map<number, CourseHole>();
    for (const ch of courseHoles) {
      map.set(ch.hole_number, ch);
    }
    return map;
  }, [courseHoles]);

  // 计算统计数据
  const stats = useMemo(() => {
    let totalScore = 0;
    let totalPutts = 0;
    let fwCount = 0;
    let girCount = 0;
    let totalPar = 0;
    let holesWithScore = 0;

    for (const hole of holes) {
      if (hole.score !== null) {
        totalScore += hole.score;
        holesWithScore++;
      }
      if (hole.putts !== null) {
        totalPutts += hole.putts;
      }
      if (hole.tee_result === "FW") {
        fwCount++;
      }
      if (hole.approach_result === "GIR") {
        girCount++;
      }
    }

    for (const ch of courseHoles) {
      totalPar += ch.par;
    }

    return { totalScore, totalPutts, fwCount, girCount, totalPar, holesWithScore };
  }, [holes, courseHoles]);

  // 通知父组件总分变化
  useMemo(() => {
    if (stats.holesWithScore > 0 && onTotalScoreChange) {
      onTotalScoreChange(stats.totalScore);
    }
  }, [stats.totalScore, stats.holesWithScore, onTotalScoreChange]);

  // 确定显示的洞号列表
  const holeNumbers = useMemo(() => {
    const nums = new Set<number>();
    for (const ch of courseHoles) nums.add(ch.hole_number);
    for (const h of holes) nums.add(h.hole_number);
    return Array.from(nums).sort((a, b) => a - b);
  }, [courseHoles, holes]);

  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-[0.8125rem]">
        <thead>
          <tr className="border-b border-divider text-left">
            <th className="py-2 pr-2 font-semibold text-secondary">Hole</th>
            <th className="py-2 pr-2 font-semibold text-secondary">Par</th>
            <th className="py-2 pr-2 font-semibold text-secondary">Club</th>
            <th className="py-2 pr-2 font-semibold text-secondary">Result</th>
            <th className="py-2 pr-2 font-semibold text-secondary">Score</th>
            <th className="py-2 font-semibold text-secondary">Putts</th>
          </tr>
        </thead>
        <tbody>
          {holeNumbers.map((num) => {
            const roundHole = holeMap.get(num);
            const courseHole = courseHoleMap.get(num);

            return (
              <tr key={num} className="border-b border-divider/50">
                <td className="py-2 pr-2 font-medium text-text">{num}</td>
                <td className="py-2 pr-2 text-secondary">
                  {courseHole?.par ?? "-"}
                </td>
                <td className="py-2 pr-2 text-text">
                  {roundHole?.tee_club ?? "-"}
                </td>
                <td className="py-2 pr-2">
                  {roundHole?.tee_result ? (
                    <span
                      className={`font-semibold ${RESULT_COLOR[roundHole.tee_result] ?? "text-text"}`}
                    >
                      {roundHole.tee_result}
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="py-2 pr-2 text-text">
                  {roundHole?.score ?? "-"}
                </td>
                <td className="py-2 text-text">
                  {roundHole?.putts ?? "-"}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-divider font-semibold">
            <td className="py-2 pr-2 text-text">Total</td>
            <td className="py-2 pr-2 text-secondary">{stats.totalPar}</td>
            <td className="py-2 pr-2" />
            <td className="py-2 pr-2 text-green-600">
              FW {stats.fwCount}
            </td>
            <td className="py-2 pr-2 text-text">
              {stats.holesWithScore > 0 ? stats.totalScore : "-"}
            </td>
            <td className="py-2 text-text">
              {stats.totalPutts > 0 ? stats.totalPutts : "-"}
            </td>
          </tr>
          <tr>
            <td colSpan={6} className="pt-1 text-[0.75rem] text-secondary">
              GIR: {stats.girCount} &middot; FW: {stats.fwCount} / {holeNumbers.length}
            </td>
          </tr>
        </tfoot>
      </table>
    </Card>
  );
}
