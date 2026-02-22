"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { RoundSummary } from "@/components/round/round-summary";
import { Button } from "@/components/ui/button";
import type { Round, RoundHole, CourseHole } from "@/lib/db/types";

interface RoundDetail extends Round {
  holes: RoundHole[];
  course_name: string | null;
  tee_name: string | null;
  tee_color: string | null;
  par_total: number | null;
  course_holes: CourseHole[];
}

export default function RoundDetailPage() {
  const params = useParams();
  const router = useRouter();
  const roundId = params.roundId as string;

  const [round, setRound] = useState<RoundDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function load() {
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
    load();
  }, [roundId]);

  // 当总分变化时，自动保存
  const handleTotalScoreChange = useCallback(
    async (totalScore: number) => {
      if (!round || round.total_score === totalScore) return;
      try {
        await fetch(`/api/rounds/${roundId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ total_score: totalScore }),
        });
        setRound((prev) =>
          prev ? { ...prev, total_score: totalScore } : prev
        );
      } catch {
        // 静默失败
      }
    },
    [round, roundId]
  );

  // 删除轮次
  const handleDelete = useCallback(async () => {
    if (!confirm("Delete this round? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/rounds/${roundId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/rounds");
      } else {
        setError("Failed to delete round.");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setDeleting(false);
    }
  }, [roundId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-secondary text-[0.9375rem]">Loading...</p>
      </div>
    );
  }

  if (error || !round) {
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

  const dateStr = new Date(round.played_date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-6">
      {/* 标题 */}
      <div>
        <Link href="/rounds">
          <span className="text-accent text-[0.8125rem] font-medium hover:underline cursor-pointer">
            &larr; Back to rounds
          </span>
        </Link>
        <h1 className="text-[1.875rem] font-semibold text-text mt-2">
          {round.course_name ?? "Unknown Course"} &mdash; {round.tee_name ?? ""}
        </h1>
        <p className="text-[0.9375rem] text-secondary mt-1">{dateStr}</p>
        {round.total_score !== null && (
          <p className="text-[1.25rem] font-semibold text-text mt-2">
            Total: {round.total_score}
          </p>
        )}
      </div>

      {/* 汇总表格 */}
      {round.holes.length > 0 ? (
        <RoundSummary
          holes={round.holes}
          courseHoles={round.course_holes}
          onTotalScoreChange={handleTotalScoreChange}
        />
      ) : (
        <div className="text-center py-8">
          <p className="text-secondary text-[0.9375rem]">
            No hole data recorded for this round.
          </p>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
          <Link href={`/rounds/${roundId}/edit`} className="flex-1">
            <Button variant="secondary" className="w-full">Edit Holes</Button>
          </Link>
          {round.recap_text ? (
            <>
              <Link href={`/rounds/${roundId}/recap`} className="flex-1">
                <Button className="w-full">View Recap</Button>
              </Link>
              <Link href={`/rounds/${roundId}/recap?regenerate=1`} className="flex-1">
                <Button variant="secondary" className="w-full">Regenerate</Button>
              </Link>
            </>
          ) : (
            <Link href={`/rounds/${roundId}/recap`} className="flex-1">
              <Button className="w-full">Generate Recap</Button>
            </Link>
          )}
        </div>
        <Button
          variant="ghost"
          onClick={handleDelete}
          disabled={deleting}
          className="text-red-500 hover:text-red-600 hover:bg-red-50"
        >
          {deleting ? "..." : "Delete Round"}
        </Button>
      </div>
    </div>
  );
}
