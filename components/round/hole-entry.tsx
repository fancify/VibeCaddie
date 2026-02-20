"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Stepper } from "@/components/ui/stepper";
import type { RoundHole } from "@/lib/db/types";

/** Tee result 按钮样式 */
const RESULT_STYLES: Record<
  string,
  { base: string; selected: string }
> = {
  FW: {
    base: "bg-green-50 text-green-700 border-green-200",
    selected: "bg-green-600 text-white border-green-600",
  },
  L: {
    base: "bg-amber-50 text-amber-700 border-amber-200",
    selected: "bg-amber-500 text-white border-amber-500",
  },
  R: {
    base: "bg-amber-50 text-amber-700 border-amber-200",
    selected: "bg-amber-500 text-white border-amber-500",
  },
  PEN: {
    base: "bg-red-50 text-red-700 border-red-200",
    selected: "bg-red-500 text-white border-red-500",
  },
};

const TEE_RESULTS = ["FW", "L", "R", "PEN"] as const;

interface HoleEntryProps {
  roundId: string;
  holeNumber: number;
  par: number;
  yardage: number;
  playerBagClubs: string[];
  initialData?: RoundHole | null;
  onSave?: (data: RoundHole) => void;
}

/** 单洞录入组件 — 主交互界面 */
export function HoleEntry({
  roundId,
  holeNumber,
  par,
  yardage,
  playerBagClubs,
  initialData,
  onSave,
}: HoleEntryProps) {
  const [teeClub, setTeeClub] = useState<string>(initialData?.tee_club ?? "");
  const [teeResult, setTeeResult] = useState<string>(initialData?.tee_result ?? "");
  const [clubsUsed, setClubsUsed] = useState<string[]>(initialData?.clubs_used ?? []);
  const [score, setScore] = useState<number>(initialData?.score ?? par);
  const [putts, setPutts] = useState<number>(initialData?.putts ?? 2);
  const [gir, setGir] = useState<boolean | null>(initialData?.gir ?? null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  // 当 initialData 变更时（切换洞号），重置状态
  useEffect(() => {
    setTeeClub(initialData?.tee_club ?? "");
    setTeeResult(initialData?.tee_result ?? "");
    setClubsUsed(initialData?.clubs_used ?? []);
    setScore(initialData?.score ?? par);
    setPutts(initialData?.putts ?? 2);
    setGir(initialData?.gir ?? null);
    isFirstRender.current = true;
  }, [initialData, holeNumber, par]);

  // 自动保存（防抖 500ms）— 当有 tee_club 和 tee_result 选中时触发
  const autoSave = useCallback(async () => {
    if (!teeClub || !teeResult) return;

    try {
      const res = await fetch(`/api/rounds/${roundId}/holes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hole_number: holeNumber,
          tee_club: teeClub,
          tee_result: teeResult,
          clubs_used: clubsUsed.length > 0 ? clubsUsed : null,
          score,
          putts,
          gir,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as RoundHole;
        onSave?.(data);
      }
    } catch {
      // 静默失败，下次切换洞时会重试
    }
  }, [roundId, holeNumber, teeClub, teeResult, clubsUsed, score, putts, gir, onSave]);

  // 监听所有输入变化，触发防抖保存
  useEffect(() => {
    // 跳过首次渲染
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      autoSave();
    }, 500);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [teeClub, teeResult, clubsUsed, score, putts, gir, autoSave]);

  return (
    <div className="flex flex-col gap-6">
      {/* 洞号标题 */}
      <div className="text-center">
        <h2 className="text-[1.5rem] font-semibold text-text">
          Hole {holeNumber}
        </h2>
        <p className="text-[0.9375rem] text-secondary mt-0.5">
          Par {par} &middot; {yardage} yds
        </p>
      </div>

      {/* Club Played（开球杆） */}
      <div>
        <p className="text-[0.875rem] font-medium text-text mb-2">Club Played</p>
        <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
          {playerBagClubs.map((club) => (
            <button
              key={club}
              type="button"
              onClick={() => setTeeClub(club)}
              className={`
                min-h-[44px] rounded-lg border text-[0.875rem] font-medium
                transition-colors duration-150 cursor-pointer
                ${
                  teeClub === club
                    ? "bg-accent text-white border-accent"
                    : "bg-white text-text border-divider hover:bg-bg"
                }
              `}
            >
              {club}
            </button>
          ))}
        </div>
      </div>

      {/* Drive Result 选择 */}
      <div>
        <p className="text-[0.875rem] font-medium text-text mb-2">Drive Result</p>
        <div className="grid grid-cols-4 gap-2">
          {TEE_RESULTS.map((result) => {
            const styles = RESULT_STYLES[result];
            const isSelected = teeResult === result;
            return (
              <button
                key={result}
                type="button"
                onClick={() => setTeeResult(result)}
                className={`
                  min-h-[44px] rounded-lg border text-[0.9375rem] font-semibold
                  transition-colors duration-150 cursor-pointer
                  ${isSelected ? styles.selected : styles.base}
                `}
              >
                {result}
              </button>
            );
          })}
        </div>
      </div>

      {/* Clubs Used — 多选，记录这洞用了哪些球杆 */}
      <div>
        <p className="text-[0.875rem] font-medium text-text mb-2">
          Clubs Used
          {clubsUsed.length > 0 && (
            <span className="text-secondary font-normal ml-1.5">
              ({clubsUsed.length})
            </span>
          )}
        </p>
        <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
          {playerBagClubs.map((club) => {
            const isSelected = clubsUsed.includes(club);
            return (
              <button
                key={club}
                type="button"
                onClick={() => {
                  setClubsUsed((prev) =>
                    isSelected
                      ? prev.filter((c) => c !== club)
                      : [...prev, club]
                  );
                }}
                className={`
                  min-h-[44px] rounded-lg border text-[0.875rem] font-medium
                  transition-colors duration-150 cursor-pointer
                  ${
                    isSelected
                      ? "bg-accent/15 text-accent border-accent/40"
                      : "bg-white text-text border-divider hover:bg-bg"
                  }
                `}
              >
                {club}
              </button>
            );
          })}
        </div>
      </div>

      {/* Score 和 Putts */}
      <div className="flex justify-center gap-10">
        <Stepper
          label="Score"
          value={score}
          onChange={setScore}
          min={1}
          max={20}
        />
        <Stepper
          label="Putts"
          value={putts}
          onChange={setPutts}
          min={0}
          max={10}
        />
      </div>

      {/* GIR 切换 */}
      <div>
        <p className="text-[0.875rem] font-medium text-text mb-2 text-center">GIR</p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => setGir(true)}
            className={`
              min-h-[44px] min-w-[80px] rounded-lg border text-[0.9375rem] font-medium
              transition-colors duration-150 cursor-pointer
              ${
                gir === true
                  ? "bg-accent text-white border-accent"
                  : "bg-white text-text border-divider hover:bg-bg"
              }
            `}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setGir(false)}
            className={`
              min-h-[44px] min-w-[80px] rounded-lg border text-[0.9375rem] font-medium
              transition-colors duration-150 cursor-pointer
              ${
                gir === false
                  ? "bg-accent text-white border-accent"
                  : "bg-white text-text border-divider hover:bg-bg"
              }
            `}
          >
            No
          </button>
        </div>
      </div>
    </div>
  );
}
