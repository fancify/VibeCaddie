"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlannedRoundPicker } from "@/components/round/planned-round-picker";
import { RoundSetup } from "@/components/round/round-setup";
import { HoleEntry, type HoleEntryHandle, type HoleLocalData } from "@/components/round/hole-entry";
import { HoleEntryNav } from "@/components/round/hole-entry-nav";
import { Card } from "@/components/ui/card";
import type { CourseHole, RoundHole, PlayerBagClub } from "@/lib/db/types";

type RecapMode = "pick" | "manual" | "entry";

function NewRoundContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL 参数：从 briefing 页面跳转时自动传入
  const urlCourseTeeId = searchParams.get("course_tee_id");
  const urlPlayDate = searchParams.get("play_date");

  // 选择模式：pick（从 plan 中选）、manual（手动选球场）、entry（洞录入）
  const [mode, setMode] = useState<RecapMode>("pick");

  // 轮次创建后的状态
  const [roundId, setRoundId] = useState<string | null>(null);
  const [courseTeeId, setCourseTeeId] = useState<string | null>(null);

  // 洞录入阶段
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [bagClubs, setBagClubs] = useState<string[]>([]);
  const [currentHole, setCurrentHole] = useState(1);
  const [holesData, setHolesData] = useState<Map<number, RoundHole>>(new Map());
  // 本地暂存（API 保存前也能记住数据）
  const [localHolesData, setLocalHolesData] = useState<Map<number, HoleLocalData>>(new Map());
  const [loadingHoles, setLoadingHoles] = useState(false);

  // HoleEntry 的 ref，用于切换洞时触发保存
  const holeEntryRef = useRef<HoleEntryHandle>(null);

  // 创建轮次的状态（用于 planned round 路径）
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // 轮次创建后，加载球洞配置和球包
  useEffect(() => {
    if (!courseTeeId || !roundId) return;

    setLoadingHoles(true);

    fetch("/api/profile/bag")
      .then((res) => (res.ok ? res.json() : []))
      .then((clubs) => {
        const enabledClubs = (clubs as PlayerBagClub[])
          .filter((c) => c.enabled)
          .map((c) => c.club_code);
        setBagClubs(enabledClubs);
      });

    fetch(`/api/rounds/${roundId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.course_holes) {
          setCourseHoles(data.course_holes as CourseHole[]);
        }
      })
      .finally(() => setLoadingHoles(false));
  }, [courseTeeId, roundId]);

  // 从 planned round 选择后，创建 round 并进入录入
  const handleSelectPlanned = useCallback(
    async (briefing: { course_tee_id: string; play_date: string }) => {
      setCreating(true);
      setCreateError("");

      try {
        const res = await fetch("/api/rounds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            course_tee_id: briefing.course_tee_id,
            played_date: briefing.play_date,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setRoundId(data.id);
          setCourseTeeId(briefing.course_tee_id);
          setCurrentHole(1);
          setMode("entry");
        } else {
          const errData = await res.json().catch(() => null);
          setCreateError(errData?.error ?? "Failed to create round.");
        }
      } catch {
        setCreateError("Something went wrong. Please try again.");
      } finally {
        setCreating(false);
      }
    },
    []
  );

  // 从 URL 参数自动创建 round（从 briefing 页面跳转时）
  const autoCreatedRef = useRef(false);
  useEffect(() => {
    if (!urlCourseTeeId || !urlPlayDate || autoCreatedRef.current) return;
    autoCreatedRef.current = true;
    handleSelectPlanned({ course_tee_id: urlCourseTeeId, play_date: urlPlayDate });
  }, [urlCourseTeeId, urlPlayDate, handleSelectPlanned]);

  // 手动创建路径完成回调
  const handleManualCreated = useCallback(
    (newRoundId: string, newCourseTeeId: string) => {
      setRoundId(newRoundId);
      setCourseTeeId(newCourseTeeId);
      setCurrentHole(1);
      setMode("entry");
    },
    []
  );

  // API 保存成功回调
  const handleHoleSave = useCallback((data: RoundHole) => {
    setHolesData((prev) => {
      const next = new Map(prev);
      next.set(data.hole_number, data);
      return next;
    });
  }, []);

  // 本地暂存回调（切换洞前总是触发）
  const handleLocalChange = useCallback((data: HoleLocalData) => {
    setLocalHolesData((prev) => {
      const next = new Map(prev);
      next.set(data.hole_number, data);
      return next;
    });
  }, []);

  // 切换到上一洞（先保存当前洞）
  const handlePrev = useCallback(async () => {
    await holeEntryRef.current?.save();
    setCurrentHole((h) => Math.max(1, h - 1));
  }, []);

  // 切换到下一洞（先保存当前洞）
  const handleNext = useCallback(async () => {
    await holeEntryRef.current?.save();
    setCurrentHole((h) => Math.min(courseHoles.length || 18, h + 1));
  }, [courseHoles.length]);

  // 直接跳转到指定洞（先保存当前洞）
  const handleJumpTo = useCallback(async (holeNum: number) => {
    await holeEntryRef.current?.save();
    setCurrentHole(holeNum);
  }, []);

  // 完成轮次（保存所有未存的洞 + 当前洞）
  const handleFinish = useCallback(async () => {
    if (!roundId) return;

    // 1. 先保存当前洞
    await holeEntryRef.current?.save();

    // 2. 把所有本地暂存但未 API 保存的洞批量保存
    const savePromises: Promise<void>[] = [];
    for (const [num, local] of localHolesData.entries()) {
      if (holesData.has(num)) continue; // 已有 API 数据，跳过
      if (!local.tee_club || !local.tee_result) continue; // 数据不完整，跳过
      savePromises.push(
        fetch(`/api/rounds/${roundId}/holes`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hole_number: local.hole_number,
            tee_club: local.tee_club,
            tee_result: local.tee_result,
            clubs_used: local.clubs_used.length > 0 ? local.clubs_used : null,
            score: local.score,
            putts: local.putts,
            gir: local.gir,
          }),
        }).then(() => {})
      );
    }
    await Promise.all(savePromises);

    // 3. 计算总杆数
    let totalScore = 0;
    let hasScores = false;
    const allHoleNums = new Set([...holesData.keys(), ...localHolesData.keys()]);
    for (const num of allHoleNums) {
      const apiHole = holesData.get(num);
      const localHole = localHolesData.get(num);
      const s = apiHole?.score ?? localHole?.score;
      if (s !== null && s !== undefined) {
        totalScore += s;
        hasScores = true;
      }
    }

    if (hasScores) {
      try {
        await fetch(`/api/rounds/${roundId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ total_score: totalScore }),
        });
      } catch {
        // 更新失败也跳转
      }
    }

    router.push(`/rounds/${roundId}`);
  }, [roundId, holesData, localHolesData, router]);

  // ── 选择模式：从已 plan 的 round 中选 ──
  if (mode === "pick") {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-[1.875rem] font-semibold text-text">
            Round Recap
          </h1>
          <p className="text-[0.9375rem] text-secondary mt-1">
            Select a planned round to record your post-round results.
          </p>
        </div>

        {creating ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <div className="w-8 h-8 border-3 border-accent/30 border-t-accent rounded-full animate-spin" />
            <p className="text-[0.9375rem] text-secondary">
              Setting up your recap...
            </p>
          </div>
        ) : (
          <>
            {createError && (
              <p className="text-[0.8125rem] text-red-500 text-center">
                {createError}
              </p>
            )}
            <PlannedRoundPicker
              onSelect={handleSelectPlanned}
              onManual={() => setMode("manual")}
            />
          </>
        )}
      </div>
    );
  }

  // ── 手动模式：搜索球场创建 round ──
  if (mode === "manual") {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <button
              onClick={() => setMode("pick")}
              className="text-accent text-[0.8125rem] font-medium hover:underline cursor-pointer"
            >
              &larr; Back
            </button>
          </div>
          <h1 className="text-[1.875rem] font-semibold text-text">
            Round Recap
          </h1>
          <p className="text-[0.9375rem] text-secondary mt-1">
            Select a course and tee to record your post-round results.
          </p>
        </div>

        <RoundSetup onCreated={handleManualCreated} />
      </div>
    );
  }

  // ── 录入模式：洞 by 洞录入 ──
  if (loadingHoles) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-secondary text-[0.9375rem]">Loading course data...</p>
      </div>
    );
  }

  const totalHoles = courseHoles.length || 18;
  const currentCourseHole = courseHoles.find(
    (ch) => ch.hole_number === currentHole
  );
  const holesWithData = Array.from({ length: totalHoles }, (_, i) =>
    holesData.has(i + 1) || localHolesData.has(i + 1)
  );

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <HoleEntry
          ref={holeEntryRef}
          roundId={roundId!}
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

export default function NewRoundPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <p className="text-secondary text-[0.9375rem]">Loading...</p>
        </div>
      }
    >
      <NewRoundContent />
    </Suspense>
  );
}
