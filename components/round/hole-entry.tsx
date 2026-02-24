"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { Stepper } from "@/components/ui/stepper";
import type { RoundHole } from "@/lib/db/types";

// ─── Tee Result ───────────────────────────────────────────────────────────────

const TEE_RESULTS = ["FW", "LEFT", "RIGHT", "OB"] as const;
type TeeResult = (typeof TEE_RESULTS)[number];

const TEE_RESULT_LABELS: Record<TeeResult, string> = {
  FW: "FW",
  LEFT: "Left",
  RIGHT: "Right",
  OB: "OB",
};

const TEE_RESULT_STYLES: Record<TeeResult, { base: string; selected: string }> = {
  FW:    { base: "bg-green-50 text-green-700 border-green-200",   selected: "bg-green-600 text-white border-green-600" },
  LEFT:  { base: "bg-amber-50 text-amber-700 border-amber-200",   selected: "bg-amber-500 text-white border-amber-500" },
  RIGHT: { base: "bg-amber-50 text-amber-700 border-amber-200",   selected: "bg-amber-500 text-white border-amber-500" },
  OB:    { base: "bg-red-50 text-red-700 border-red-200",         selected: "bg-red-500 text-white border-red-500" },
};

// ─── Approach Result ──────────────────────────────────────────────────────────

const APPROACH_RESULTS = ["GIR", "SHORT", "LONG", "LEFT", "RIGHT"] as const;
type ApproachResult = (typeof APPROACH_RESULTS)[number];

const APPROACH_RESULT_LABELS: Record<ApproachResult, string> = {
  GIR:   "GIR",
  SHORT: "Short",
  LONG:  "Long",
  LEFT:  "Left",
  RIGHT: "Right",
};

const APPROACH_RESULT_STYLES: Record<ApproachResult, { base: string; selected: string }> = {
  GIR:   { base: "bg-green-50 text-green-700 border-green-200",   selected: "bg-green-600 text-white border-green-600" },
  SHORT: { base: "bg-amber-50 text-amber-700 border-amber-200",   selected: "bg-amber-500 text-white border-amber-500" },
  LONG:  { base: "bg-amber-50 text-amber-700 border-amber-200",   selected: "bg-amber-500 text-white border-amber-500" },
  LEFT:  { base: "bg-amber-50 text-amber-700 border-amber-200",   selected: "bg-amber-500 text-white border-amber-500" },
  RIGHT: { base: "bg-amber-50 text-amber-700 border-amber-200",   selected: "bg-amber-500 text-white border-amber-500" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ClubGridProps {
  clubs: string[];
  selected: string;
  onSelect: (club: string) => void;
}

function ClubGrid({ clubs, selected, onSelect }: ClubGridProps) {
  if (clubs.length === 0) {
    return (
      <p className="text-[0.8125rem] text-secondary italic">
        No clubs in bag — add clubs in Profile first.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
      {clubs.map((club) => (
        <button
          key={club}
          type="button"
          onClick={() => onSelect(selected === club ? "" : club)}
          className={`
            min-h-[44px] rounded-lg border text-[0.875rem] font-medium
            transition-colors duration-150 cursor-pointer
            ${selected === club
              ? "bg-accent/15 text-accent border-accent/40"
              : "bg-white text-text border-divider hover:bg-bg"
            }
          `}
        >
          {club}
        </button>
      ))}
    </div>
  );
}

interface CounterProps {
  label: string;
  labelColor: string;
  value: number;
  onChange: (v: number) => void;
}

function Counter({ label, labelColor, value, onChange }: CounterProps) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className={`text-[0.8125rem] font-medium ${labelColor}`}>{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value === 0}
          className="w-9 h-9 rounded-lg border border-divider bg-white text-text text-lg flex items-center justify-center hover:bg-bg cursor-pointer disabled:opacity-30"
        >
          &minus;
        </button>
        <span className="w-8 text-center text-[1.125rem] font-semibold text-text tabular-nums">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(9, value + 1))}
          disabled={value === 9}
          className="w-9 h-9 rounded-lg border border-divider bg-white text-text text-lg flex items-center justify-center hover:bg-bg cursor-pointer disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}

// ─── Public interfaces ────────────────────────────────────────────────────────

export interface HoleEntryHandle {
  save: () => Promise<void>;
}

export interface HoleLocalData {
  hole_number: number;
  tee_club: string;
  tee_result: string;
  approach_club: string;
  approach_result: string;
  recovery_club: string;
  bunker_count: number;
  water_count: number;
  penalty_count: number;
  score: number;
  putts: number;
}

interface HoleEntryProps {
  roundId: string;
  holeNumber: number;
  par: number;
  yardage: number;
  playerBagClubs: string[];
  initialData?: RoundHole | null;
  localData?: HoleLocalData | null;
  onSave?: (data: RoundHole) => void;
  onLocalChange?: (data: HoleLocalData) => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export const HoleEntry = forwardRef<HoleEntryHandle, HoleEntryProps>(
  function HoleEntry(
    { roundId, holeNumber, par, yardage, playerBagClubs, initialData, localData, onSave, onLocalChange },
    ref
  ) {
    // 不含 Putter 的球杆列表
    const selectableClubs = playerBagClubs.filter((c) => c !== "Putter");

    // 优先本地暂存 → API 数据 → 默认值
    const [teeClub,       setTeeClub]       = useState(localData?.tee_club       ?? initialData?.tee_club       ?? "");
    const [teeResult,     setTeeResult]     = useState(localData?.tee_result     ?? initialData?.tee_result     ?? "");
    const [approachClub,  setApproachClub]  = useState(localData?.approach_club  ?? initialData?.approach_club  ?? "");
    const [approachResult,setApproachResult]= useState(localData?.approach_result ?? (initialData?.approach_result ?? ""));
    const [recoveryClub,  setRecoveryClub]  = useState(localData?.recovery_club  ?? initialData?.recovery_club  ?? "");
    const [bunkerCount,   setBunkerCount]   = useState(localData?.bunker_count   ?? initialData?.bunker_count   ?? 0);
    const [waterCount,    setWaterCount]    = useState(localData?.water_count    ?? initialData?.water_count    ?? 0);
    const [penaltyCount,  setPenaltyCount]  = useState(localData?.penalty_count  ?? initialData?.penalty_count  ?? 0);
    const [score,         setScore]         = useState(localData?.score          ?? initialData?.score          ?? par);
    const [putts,         setPutts]         = useState(localData?.putts          ?? initialData?.putts          ?? 2);

    const [saving, setSaving] = useState(false);
    const [saved,  setSaved]  = useState(false);

    // 切换洞号时重置
    useEffect(() => {
      setTeeClub      (localData?.tee_club       ?? initialData?.tee_club       ?? "");
      setTeeResult    (localData?.tee_result     ?? initialData?.tee_result     ?? "");
      setApproachClub (localData?.approach_club  ?? initialData?.approach_club  ?? "");
      setApproachResult(localData?.approach_result ?? (initialData?.approach_result ?? ""));
      setRecoveryClub (localData?.recovery_club  ?? initialData?.recovery_club  ?? "");
      setBunkerCount  (localData?.bunker_count   ?? initialData?.bunker_count   ?? 0);
      setWaterCount   (localData?.water_count    ?? initialData?.water_count    ?? 0);
      setPenaltyCount (localData?.penalty_count  ?? initialData?.penalty_count  ?? 0);
      setScore        (localData?.score          ?? initialData?.score          ?? par);
      setPutts        (localData?.putts          ?? initialData?.putts          ?? 2);
      setSaved(false);
    }, [holeNumber, initialData, localData, par]); // eslint-disable-line react-hooks/exhaustive-deps

    const buildLocal = useCallback((): HoleLocalData => ({
      hole_number:    holeNumber,
      tee_club:       teeClub,
      tee_result:     teeResult,
      approach_club:  approachClub,
      approach_result:approachResult,
      recovery_club:  recoveryClub,
      bunker_count:   bunkerCount,
      water_count:    waterCount,
      penalty_count:  penaltyCount,
      score,
      putts,
    }), [holeNumber, teeClub, teeResult, approachClub, approachResult, recoveryClub, bunkerCount, waterCount, penaltyCount, score, putts]);

    const doApiSave = useCallback(async () => {
      setSaving(true);
      try {
        const res = await fetch(`/api/rounds/${roundId}/holes`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hole_number:    holeNumber,
            tee_club:       teeClub       || undefined,
            tee_result:     teeResult     || undefined,
            approach_club:  approachClub  || undefined,
            approach_result:approachResult || undefined,
            recovery_club:  recoveryClub  || undefined,
            score,
            putts,
            bunker_count:  bunkerCount,
            water_count:   waterCount,
            penalty_count: penaltyCount,
          }),
        });

        if (res.ok) {
          const data = (await res.json()) as RoundHole;
          onSave?.(data);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
          return true;
        } else {
          const errBody = await res.text().catch(() => "");
          console.error(`[VibeCaddie] Hole ${holeNumber}: save FAILED (${res.status})`, errBody);
        }
      } catch (err) {
        console.error(`[VibeCaddie] Hole ${holeNumber}: save ERROR`, err);
      } finally {
        setSaving(false);
      }
      return false;
    }, [roundId, holeNumber, teeClub, teeResult, approachClub, approachResult, recoveryClub, score, putts, bunkerCount, waterCount, penaltyCount, onSave]);

    useImperativeHandle(ref, () => ({
      save: async () => {
        const local = buildLocal();
        onLocalChange?.(local);
        await doApiSave();
      },
    }), [buildLocal, doApiSave, onLocalChange]);

    const showRecovery = approachResult !== "" && approachResult !== "GIR";

    function mark() { setSaved(false); }

    return (
      <div className="flex flex-col gap-6">

        {/* Hole header */}
        <div className="text-center">
          <h2 className="text-[1.5rem] font-semibold text-text">Hole {holeNumber}</h2>
          <p className="text-[0.9375rem] text-secondary mt-0.5">
            Par {par} &middot; {yardage} yds
          </p>
        </div>

        {/* ① Score + Putts — top and most visible */}
        <div className="flex justify-center gap-10">
          <Stepper label="Score" value={score} onChange={(v) => { setScore(v); mark(); }} min={1} max={20} />
          <Stepper label="Putts" value={putts} onChange={(v) => { setPutts(v); mark(); }} min={0} max={10} />
        </div>

        {/* ② Tee Shot */}
        <div className="flex flex-col gap-3">
          <p className="text-[0.875rem] font-semibold text-text">Tee Shot</p>
          <ClubGrid
            clubs={selectableClubs}
            selected={teeClub}
            onSelect={(c) => { setTeeClub(c); mark(); }}
          />
          <div className="grid grid-cols-4 gap-2">
            {TEE_RESULTS.map((result) => {
              const st = TEE_RESULT_STYLES[result];
              return (
                <button
                  key={result}
                  type="button"
                  onClick={() => { setTeeResult(teeResult === result ? "" : result); mark(); }}
                  className={`
                    min-h-[44px] rounded-lg border text-[0.875rem] font-semibold
                    transition-colors duration-150 cursor-pointer
                    ${teeResult === result ? st.selected : st.base}
                  `}
                >
                  {TEE_RESULT_LABELS[result]}
                </button>
              );
            })}
          </div>
        </div>

        {/* ③ Approach */}
        <div className="flex flex-col gap-3">
          <p className="text-[0.875rem] font-semibold text-text">Approach</p>
          <ClubGrid
            clubs={selectableClubs}
            selected={approachClub}
            onSelect={(c) => { setApproachClub(c); mark(); }}
          />
          <div className="grid grid-cols-5 gap-2">
            {APPROACH_RESULTS.map((result) => {
              const st = APPROACH_RESULT_STYLES[result];
              return (
                <button
                  key={result}
                  type="button"
                  onClick={() => { setApproachResult(approachResult === result ? "" : result); mark(); }}
                  className={`
                    min-h-[44px] rounded-lg border text-[0.8125rem] font-semibold
                    transition-colors duration-150 cursor-pointer
                    ${approachResult === result ? st.selected : st.base}
                  `}
                >
                  {APPROACH_RESULT_LABELS[result]}
                </button>
              );
            })}
          </div>
        </div>

        {/* ④ Recovery — only when green was missed */}
        {showRecovery && (
          <div className="flex flex-col gap-3">
            <p className="text-[0.875rem] font-semibold text-text">Recovery</p>
            <ClubGrid
              clubs={selectableClubs}
              selected={recoveryClub}
              onSelect={(c) => { setRecoveryClub(c); mark(); }}
            />
          </div>
        )}

        {/* ⑤ Hazards */}
        <div className="flex flex-col gap-3">
          <p className="text-[0.875rem] font-semibold text-text">Hazards</p>
          <div className="flex justify-center gap-8">
            <Counter
              label="Bunker"
              labelColor="text-amber-700"
              value={bunkerCount}
              onChange={(v) => { setBunkerCount(v); mark(); }}
            />
            <Counter
              label="Water"
              labelColor="text-blue-700"
              value={waterCount}
              onChange={(v) => { setWaterCount(v); mark(); }}
            />
            <Counter
              label="Penalty"
              labelColor="text-red-700"
              value={penaltyCount}
              onChange={(v) => { setPenaltyCount(v); mark(); }}
            />
          </div>
        </div>

        {/* Save status */}
        <p className="text-[0.75rem] text-secondary text-center">
          {saving ? "Saving..." : saved ? "Saved!" : "Auto-saves when you navigate"}
        </p>
      </div>
    );
  }
);
