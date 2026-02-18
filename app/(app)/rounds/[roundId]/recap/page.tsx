"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { RecapDisplay } from "@/components/recap/recap-display";
import { Button } from "@/components/ui/button";
import type { Round, CourseHole } from "@/lib/db/types";

interface RoundDetail extends Round {
  course_name: string | null;
  tee_name: string | null;
  course_holes: CourseHole[];
}

export default function RecapPage() {
  const params = useParams();
  const roundId = params.roundId as string;

  const [round, setRound] = useState<RoundDetail | null>(null);
  const [recapText, setRecapText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  // 加载轮次基本信息
  useEffect(() => {
    async function loadRound() {
      try {
        const res = await fetch(`/api/rounds/${roundId}`);
        if (res.ok) {
          const data = (await res.json()) as RoundDetail;
          setRound(data);
        } else if (res.status === 404) {
          setError("Round not found.");
        } else {
          setError("Failed to load round.");
        }
      } catch {
        setError("Something went wrong.");
      } finally {
        setLoading(false);
      }
    }
    loadRound();
  }, [roundId]);

  // 生成回顾
  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ round_id: roundId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to generate recap.");
        return;
      }

      const data = await res.json();
      setRecapText(data.recap_text);
    } catch {
      setError("Something went wrong while generating the recap.");
    } finally {
      setGenerating(false);
    }
  }, [roundId]);

  // 加载状态
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-secondary text-[0.9375rem]">Loading...</p>
      </div>
    );
  }

  // 错误状态（找不到轮次）
  if (!round) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-secondary text-[0.9375rem]">
          {error || "Round not found."}
        </p>
        <Link href="/rounds">
          <span className="text-accent text-[0.9375rem] font-medium hover:underline cursor-pointer">
            Back to rounds
          </span>
        </Link>
      </div>
    );
  }

  // 正在生成
  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-secondary text-[0.9375rem]">
          Generating your recap...
        </p>
      </div>
    );
  }

  // 已经有回顾内容，展示它
  if (recapText) {
    return (
      <div className="flex flex-col gap-4">
        <Link href={`/rounds/${roundId}`}>
          <span className="text-accent text-[0.8125rem] font-medium hover:underline cursor-pointer">
            &larr; Back to round
          </span>
        </Link>
        <RecapDisplay
          recapText={recapText}
          courseName={round.course_name ?? "Unknown Course"}
          teeName={round.tee_name ?? ""}
          playedDate={round.played_date}
        />
      </div>
    );
  }

  // 尚未生成回顾，展示生成按钮
  const dateStr = new Date(round.played_date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/rounds/${roundId}`}>
          <span className="text-accent text-[0.8125rem] font-medium hover:underline cursor-pointer">
            &larr; Back to round
          </span>
        </Link>
        <h1 className="text-[1.875rem] font-semibold text-text mt-2">
          Post-Round Recap
        </h1>
        <p className="text-[0.9375rem] text-secondary mt-1">
          {round.course_name ?? "Unknown Course"} &mdash; {round.tee_name ?? ""}{" "}
          &#183; {dateStr}
        </p>
      </div>

      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <p className="text-secondary text-[0.9375rem] text-center max-w-md">
          Ready to review your round? We&apos;ll analyze your results, compare
          them with your pre-round plan, and give you personalized insights.
        </p>

        {error && (
          <p className="text-red-600 text-[0.875rem] text-center">{error}</p>
        )}

        <Button onClick={handleGenerate} className="mt-2">
          Generate Recap
        </Button>
      </div>
    </div>
  );
}
