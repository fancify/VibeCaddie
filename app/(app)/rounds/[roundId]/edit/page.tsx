"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { HoleEntry, type HoleEntryHandle, type HoleLocalData } from "@/components/round/hole-entry";
import { HoleEntryNav } from "@/components/round/hole-entry-nav";
import { Card } from "@/components/ui/card";
import type { CourseHole, RoundHole } from "@/lib/db/types";

interface RoundInfo {
  id: string;
  course_tee_id: string;
  course_name: string | null;
  tee_name: string | null;
  holes: RoundHole[];
  course_holes: CourseHole[];
}

export default function EditRoundPage() {
  const params = useParams();
  const router = useRouter();
  const roundId = params.roundId as string;

  const [roundInfo, setRoundInfo] = useState<RoundInfo | null>(null);
  const [bagClubs, setBagClubs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentHole, setCurrentHole] = useState(1);
  const [holesData, setHolesData] = useState<Map<number, RoundHole>>(new Map());
  const [localHolesData, setLocalHolesData] = useState<Map<number, HoleLocalData>>(new Map());

  // 用 ref 同步跟踪最新数据，避免 handleFinish 闭包读到过期 state
  const holesDataRef = useRef<Map<number, RoundHole>>(new Map());
  const localHolesDataRef = useRef<Map<number, HoleLocalData>>(new Map());

  const holeEntryRef = useRef<HoleEntryHandle>(null);

  // 加载 round 数据 + bag clubs
  useEffect(() => {
    async function load() {
      try {
        const [roundRes, bagRes] = await Promise.all([
          fetch(`/api/rounds/${roundId}`),
          fetch("/api/profile/bag"),
        ]);

        if (!roundRes.ok) {
          setError("Round not found.");
          setLoading(false);
          return;
        }

        const round = (await roundRes.json()) as RoundInfo;
        setRoundInfo(round);

        // 预加载已有洞数据
        const map = new Map<number, RoundHole>();
        for (const h of round.holes) {
          map.set(h.hole_number, h);
        }
        holesDataRef.current = map;
        setHolesData(map);

        if (bagRes.ok) {
          const clubs = (await bagRes.json()) as Array<{ club_code: string; enabled: boolean }>;
          setBagClubs(clubs.filter((c) => c.enabled).map((c) => c.club_code));
        }
      } catch {
        setError("Failed to load round data.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [roundId]);

  // API 保存回调 — 立即更新 ref，然后更新 state
  const handleHoleSave = useCallback((data: RoundHole) => {
    const next = new Map(holesDataRef.current);
    next.set(data.hole_number, data);
    holesDataRef.current = next;
    setHolesData(next);
  }, []);

  // 本地暂存回调 — 立即更新 ref，然后更新 state
  const handleLocalChange = useCallback((data: HoleLocalData) => {
    const next = new Map(localHolesDataRef.current);
    next.set(data.hole_number, data);
    localHolesDataRef.current = next;
    setLocalHolesData(next);
  }, []);

  // 切洞
  const handlePrev = useCallback(async () => {
    await holeEntryRef.current?.save();
    setCurrentHole((h) => Math.max(1, h - 1));
  }, []);

  const handleNext = useCallback(async () => {
    await holeEntryRef.current?.save();
    const total = roundInfo?.course_holes.length || 18;
    setCurrentHole((h) => Math.min(total, h + 1));
  }, [roundInfo?.course_holes.length]);

  // 直接跳转到指定洞（先保存当前洞）
  const handleJumpTo = useCallback(async (holeNum: number) => {
    await holeEntryRef.current?.save();
    setCurrentHole(holeNum);
  }, []);

  // 完成编辑 — 保存所有未存的洞 + 更新总分
  // 用 ref 读取最新数据，避免闭包读到过期 state
  const handleFinish = useCallback(async () => {
    // 1. 先保存当前洞（会同步更新 ref）
    await holeEntryRef.current?.save();

    // 2. 从 ref 读取最新本地数据
    const latestLocal = localHolesDataRef.current;
    const latestApi = holesDataRef.current;

    console.warn("[VibeCaddie] handleFinish — localHolesData size:", latestLocal.size);
    console.warn("[VibeCaddie] handleFinish — holesData (API) size:", latestApi.size);
    for (const [num, local] of latestLocal.entries()) {
      console.warn(`[VibeCaddie]   Hole ${num}: tee_club="${local.tee_club}", tee_result="${local.tee_result}", approach="${local.approach_distance}/${local.approach_direction}", score=${local.score}`);
    }

    // 3. 全量 upsert 所有有数据的洞（API 会为空 tee_club/tee_result 提供默认值）
    const savePromises: Promise<{ hole: number; ok: boolean; status?: number }>[] = [];

    for (const [, local] of latestLocal.entries()) {
      savePromises.push(
        fetch(`/api/rounds/${roundId}/holes`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hole_number:    local.hole_number,
            tee_club:          local.tee_club          || undefined,
            tee_result:        local.tee_result        || undefined,
            approach_club:     local.approach_club     || undefined,
            approach_distance: local.approach_distance || undefined,
            approach_direction:local.approach_direction || undefined,
            recovery_club:     local.recovery_club     || undefined,
            score:          local.score,
            putts:          local.putts,
            bunker_count:   local.bunker_count,
            water_count:    local.water_count,
            penalty_count:  local.penalty_count,
          }),
        }).then(
          (res) => ({ hole: local.hole_number, ok: res.ok, status: res.status }),
          () => ({ hole: local.hole_number, ok: false, status: 0 })
        )
      );
    }

    const results = await Promise.all(savePromises);
    const failed = results.filter((r) => !r.ok);

    if (failed.length > 0) {
      console.error(`[VibeCaddie] FAILED holes:`, failed);
    }
    console.warn(`[VibeCaddie] Batch save: ${results.length - failed.length}/${results.length} OK`);

    // 4. 重新计算总分
    let totalScore = 0;
    let hasScores = false;
    const allNums = new Set([...latestApi.keys(), ...latestLocal.keys()]);
    for (const num of allNums) {
      const s = latestApi.get(num)?.score ?? latestLocal.get(num)?.score;
      if (s !== null && s !== undefined) {
        totalScore += s;
        hasScores = true;
      }
    }

    if (hasScores) {
      await fetch(`/api/rounds/${roundId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ total_score: totalScore }),
      }).catch(() => {});
    }

    router.push(`/rounds/${roundId}`);
  }, [roundId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-secondary text-[0.9375rem]">Loading...</p>
      </div>
    );
  }

  if (error || !roundInfo) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-secondary text-[0.9375rem]">{error || "Round not found."}</p>
        <Link href="/rounds">
          <span className="text-accent text-[0.9375rem] font-medium hover:underline cursor-pointer">
            Back to rounds
          </span>
        </Link>
      </div>
    );
  }

  const courseHoles = roundInfo.course_holes;
  const totalHoles = courseHoles.length || 18;
  const currentCourseHole = courseHoles.find((ch) => ch.hole_number === currentHole);
  const holesWithData = Array.from({ length: totalHoles }, (_, i) =>
    holesData.has(i + 1) || localHolesData.has(i + 1)
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/rounds/${roundId}`}>
          <span className="text-accent text-[0.8125rem] font-medium hover:underline cursor-pointer">
            &larr; Back to round
          </span>
        </Link>
        <h1 className="text-[1.5rem] font-semibold text-text mt-2">
          Edit — {roundInfo.course_name ?? "Unknown"} ({roundInfo.tee_name ?? ""})
        </h1>
      </div>

      <Card>
        <HoleEntry
          ref={holeEntryRef}
          roundId={roundId}
          holeNumber={currentHole}
          par={currentCourseHole?.par ?? 4}
          yardage={currentCourseHole?.yardage ?? 0}
          playerBagClubs={bagClubs}
          initialData={holesData.get(currentHole) ?? null}
          localData={localHolesData.get(currentHole) ?? null}
          onSave={handleHoleSave}
          onLocalChange={handleLocalChange}
        />
      </Card>

      <HoleEntryNav
        currentHole={currentHole}
        totalHoles={totalHoles}
        holesWithData={holesWithData}
        onPrev={handlePrev}
        onNext={handleNext}
        onFinish={handleFinish}
        onJumpTo={handleJumpTo}
      />
    </div>
  );
}
