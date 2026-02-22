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

  // API 保存回调
  const handleHoleSave = useCallback((data: RoundHole) => {
    setHolesData((prev) => {
      const next = new Map(prev);
      next.set(data.hole_number, data);
      return next;
    });
  }, []);

  // 本地暂存回调
  const handleLocalChange = useCallback((data: HoleLocalData) => {
    setLocalHolesData((prev) => {
      const next = new Map(prev);
      next.set(data.hole_number, data);
      return next;
    });
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
  const handleFinish = useCallback(async () => {
    await holeEntryRef.current?.save();

    // 批量保存本地暂存的洞
    const savePromises: Promise<void>[] = [];
    for (const [num, local] of localHolesData.entries()) {
      if (holesData.has(num)) continue;
      if (!local.tee_club || !local.tee_result) continue;
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

    // 重新计算总分
    let totalScore = 0;
    let hasScores = false;
    const allNums = new Set([...holesData.keys(), ...localHolesData.keys()]);
    for (const num of allNums) {
      const s = holesData.get(num)?.score ?? localHolesData.get(num)?.score;
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
  }, [roundId, holesData, localHolesData, router]);

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
