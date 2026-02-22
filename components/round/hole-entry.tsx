"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { Stepper } from "@/components/ui/stepper";
import type { RoundHole } from "@/lib/db/types";

/** Drive result 按钮样式 */
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

export interface HoleEntryHandle {
  /** 切换洞前调用：先保本地状态，能存 API 就存 */
  save: () => Promise<void>;
}

/** 本地暂存数据（不需要完整字段也能存） */
export interface HoleLocalData {
  hole_number: number;
  clubs_used: string[];
  tee_club: string;
  tee_result: string;
  penalty_count: number;
  bunker: boolean;
  water: boolean;
  score: number;
  putts: number;
  gir: boolean | null;
}

interface HoleEntryProps {
  roundId: string;
  holeNumber: number;
  par: number;
  yardage: number;
  playerBagClubs: string[];
  initialData?: RoundHole | null;
  /** 本地暂存的数据（用于切换洞后恢复） */
  localData?: HoleLocalData | null;
  /** API 保存成功后回调 */
  onSave?: (data: RoundHole) => void;
  /** 本地状态变更回调（总是触发，用于暂存） */
  onLocalChange?: (data: HoleLocalData) => void;
}

/** 单洞录入组件 — 主交互界面 */
export const HoleEntry = forwardRef<HoleEntryHandle, HoleEntryProps>(
  function HoleEntry(
    { roundId, holeNumber, par, yardage, playerBagClubs, initialData, localData, onSave, onLocalChange },
    ref
  ) {
    // 优先用本地暂存，其次用 API 数据，最后用默认值
    const initClubs = localData?.clubs_used
      ?? initialData?.clubs_used
      ?? (initialData?.tee_club ? [initialData.tee_club] : []);
    const initTeeResult = localData?.tee_result ?? initialData?.tee_result ?? "";
    const initPenaltyCount = localData?.penalty_count ?? 1;
    const initBunker = localData?.bunker ?? false;
    const initWater = localData?.water ?? false;
    const initScore = localData?.score ?? initialData?.score ?? par;
    const initPutts = localData?.putts ?? initialData?.putts ?? 2;
    const initGir = localData?.gir ?? initialData?.gir ?? null;

    const [clubsUsed, setClubsUsed] = useState<string[]>(initClubs);
    const [teeResult, setTeeResult] = useState<string>(initTeeResult);
    const [penaltyCount, setPenaltyCount] = useState<number>(initPenaltyCount);
    const [bunker, setBunker] = useState<boolean>(initBunker);
    const [water, setWater] = useState<boolean>(initWater);
    const [score, setScore] = useState<number>(initScore);
    const [putts, setPutts] = useState<number>(initPutts);
    const [gir, setGir] = useState<boolean | null>(initGir);

    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // 切换洞号时重置
    useEffect(() => {
      const clubs = localData?.clubs_used
        ?? initialData?.clubs_used
        ?? (initialData?.tee_club ? [initialData.tee_club] : []);
      setClubsUsed(clubs);
      setTeeResult(localData?.tee_result ?? initialData?.tee_result ?? "");
      setPenaltyCount(localData?.penalty_count ?? 1);
      setBunker(localData?.bunker ?? false);
      setWater(localData?.water ?? false);
      setScore(localData?.score ?? initialData?.score ?? par);
      setPutts(localData?.putts ?? initialData?.putts ?? 2);
      setGir(localData?.gir ?? initialData?.gir ?? null);
      setSaved(false);
    }, [initialData, localData, holeNumber, par]);

    const teeClub = clubsUsed[0] ?? "";

    // 过滤掉 Putter
    const selectableClubs = playerBagClubs.filter((c) => c !== "Putter");

    function addClub(club: string) {
      setSaved(false);
      setClubsUsed((prev) => [...prev, club]);
    }

    function removeClubAt(index: number) {
      setSaved(false);
      setClubsUsed((prev) => prev.filter((_, i) => i !== index));
    }

    // 构建当前本地状态
    const buildLocal = useCallback((): HoleLocalData => ({
      hole_number: holeNumber,
      clubs_used: clubsUsed,
      tee_club: clubsUsed[0] ?? "",
      tee_result: teeResult,
      penalty_count: teeResult === "PEN" ? penaltyCount : 0,
      bunker,
      water,
      score,
      putts,
      gir,
    }), [holeNumber, clubsUsed, teeResult, penaltyCount, bunker, water, score, putts, gir]);

    // 能否进行 API 保存（DB 要求 tee_club + tee_result 非空）
    const canApiSave = !!teeClub && !!teeResult;

    // API 保存
    const doApiSave = useCallback(async () => {
      if (!canApiSave) {
        console.warn(`[VibeCaddie] Hole ${holeNumber}: skip API save — teeClub="${teeClub}", teeResult="${teeResult}"`);
        return false;
      }

      setSaving(true);
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
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
          console.warn(`[VibeCaddie] Hole ${holeNumber}: API save OK`);
          return true;
        } else {
          const errBody = await res.text().catch(() => "");
          console.error(`[VibeCaddie] Hole ${holeNumber}: API save FAILED (${res.status})`, errBody);
        }
      } catch (err) {
        console.error(`[VibeCaddie] Hole ${holeNumber}: API save ERROR`, err);
      } finally {
        setSaving(false);
      }
      return false;
    }, [roundId, holeNumber, teeClub, teeResult, clubsUsed, score, putts, gir, canApiSave, onSave]);

    // ref 暴露的 save：总是保存本地状态，能存 API 就存
    useImperativeHandle(ref, () => ({
      save: async () => {
        const local = buildLocal();
        console.warn(`[VibeCaddie] save() hole ${local.hole_number}:`, {
          tee_club: local.tee_club,
          tee_result: local.tee_result,
          clubs: local.clubs_used,
          score: local.score,
        });
        onLocalChange?.(local);
        await doApiSave();
      },
    }), [buildLocal, doApiSave, onLocalChange]);

    // 统计球杆使用次数
    const clubCounts = new Map<string, number>();
    for (const c of clubsUsed) {
      clubCounts.set(c, (clubCounts.get(c) ?? 0) + 1);
    }

    /** Drive Result 按钮标签 */
    const RESULT_LABELS: Record<string, string> = {
      FW: "FW",
      L: "Left",
      R: "Right",
      PEN: "Penalty",
    };

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

        {/* Clubs Used — 不含 Putter */}
        <div>
          <p className="text-[0.875rem] font-medium text-text mb-1">
            Clubs Used
            <span className="text-secondary font-normal ml-1.5 text-[0.8125rem]">
              tap in order played
            </span>
          </p>

          {/* 已选球杆序列 */}
          {clubsUsed.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {clubsUsed.map((club, idx) => (
                <span
                  key={`used-${idx}`}
                  className={`
                    inline-flex items-center gap-1 px-2.5 py-1 rounded-full
                    text-[0.8125rem] font-medium
                    ${idx === 0
                      ? "bg-accent/15 text-accent border border-accent/30"
                      : "bg-gray-100 text-text border border-gray-200"
                    }
                  `}
                >
                  <span className="text-[0.6875rem] text-secondary">{idx + 1}.</span>
                  {club}
                  {idx === 0 && (
                    <span className="text-[0.625rem] text-accent/70 ml-0.5">tee</span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeClubAt(idx)}
                    className="ml-0.5 text-secondary hover:text-red-500 transition-colors cursor-pointer"
                    title="Remove"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* 球杆网格 — 不含 Putter */}
          <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
            {selectableClubs.map((club) => {
              const count = clubCounts.get(club) ?? 0;
              return (
                <button
                  key={club}
                  type="button"
                  onClick={() => addClub(club)}
                  className={`
                    relative min-h-[44px] rounded-lg border text-[0.875rem] font-medium
                    transition-colors duration-150 cursor-pointer
                    ${
                      count > 0
                        ? "bg-accent/15 text-accent border-accent/40"
                        : "bg-white text-text border-divider hover:bg-bg"
                    }
                  `}
                >
                  {club}
                  {count > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-accent text-white text-[0.625rem] flex items-center justify-center font-bold">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Drive Result */}
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
                  onClick={() => { setTeeResult(teeResult === result ? "" : result); setSaved(false); }}
                  className={`
                    min-h-[44px] rounded-lg border text-[0.875rem] font-semibold
                    transition-colors duration-150 cursor-pointer
                    ${isSelected ? styles.selected : styles.base}
                  `}
                >
                  {RESULT_LABELS[result]}
                </button>
              );
            })}
          </div>

          {/* Penalty 选中时显示罚杆数输入 */}
          {teeResult === "PEN" && (
            <div className="flex items-center gap-3 mt-3 px-1">
              <span className="text-[0.8125rem] text-secondary">Penalty strokes:</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => { setPenaltyCount((p) => Math.max(1, p - 1)); setSaved(false); }}
                  className="w-8 h-8 rounded-lg border border-divider bg-white text-text text-lg font-bold flex items-center justify-center hover:bg-bg cursor-pointer"
                >
                  &minus;
                </button>
                <span className="w-8 text-center text-[1rem] font-semibold text-text">
                  {penaltyCount}
                </span>
                <button
                  type="button"
                  onClick={() => { setPenaltyCount((p) => Math.min(9, p + 1)); setSaved(false); }}
                  className="w-8 h-8 rounded-lg border border-divider bg-white text-text text-lg font-bold flex items-center justify-center hover:bg-bg cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Hazards — Bunker / Water */}
        <div>
          <p className="text-[0.875rem] font-medium text-text mb-2">Hazards</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setBunker((b) => !b); setSaved(false); }}
              className={`
                flex-1 min-h-[44px] rounded-lg border text-[0.875rem] font-medium
                transition-colors duration-150 cursor-pointer flex items-center justify-center gap-2
                ${
                  bunker
                    ? "bg-amber-500 text-white border-amber-500"
                    : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                }
              `}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 17h18M5 17c0-3 2-5 4-6s4-1 4 1 2 4 4 5 4 0 4 0" />
              </svg>
              Bunker
            </button>
            <button
              type="button"
              onClick={() => { setWater((w) => !w); setSaved(false); }}
              className={`
                flex-1 min-h-[44px] rounded-lg border text-[0.875rem] font-medium
                transition-colors duration-150 cursor-pointer flex items-center justify-center gap-2
                ${
                  water
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                }
              `}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15c2.483 0 4.345-3 4.345-3s1.862 3 4.345 3c2.483 0 4.345-3 4.345-3s1.862 3 4.345 3M3 19c2.483 0 4.345-3 4.345-3s1.862 3 4.345 3c2.483 0 4.345-3 4.345-3s1.862 3 4.345 3" />
              </svg>
              Water
            </button>
          </div>
        </div>

        {/* Score 和 Putts */}
        <div className="flex justify-center gap-10">
          <Stepper
            label="Score"
            value={score}
            onChange={(v) => { setScore(v); setSaved(false); }}
            min={1}
            max={20}
          />
          <Stepper
            label="Putts"
            value={putts}
            onChange={(v) => { setPutts(v); setSaved(false); }}
            min={0}
            max={10}
          />
        </div>

        {/* GIR */}
        <div>
          <p className="text-[0.875rem] font-medium text-text mb-2 text-center">GIR</p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => { setGir(true); setSaved(false); }}
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
              onClick={() => { setGir(false); setSaved(false); }}
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

        {/* 自动保存提示 */}
        <p className="text-[0.75rem] text-secondary text-center">
          {saving ? "Saving..." : saved ? "Saved!" : "Auto-saves when you navigate"}
        </p>
      </div>
    );
  }
);
