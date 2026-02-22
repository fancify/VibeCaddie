"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { RecapDisplay } from "@/components/recap/recap-display";
import { Button } from "@/components/ui/button";
import type { Round, CourseHole } from "@/lib/db/types";

interface RoundDetail extends Round {
  course_name: string | null;
  tee_name: string | null;
  course_holes: CourseHole[];
}

function RecapContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roundId = params.roundId as string;
  const shouldRegenerate = searchParams.get("regenerate") === "1";

  const [round, setRound] = useState<RoundDetail | null>(null);
  const [recapText, setRecapText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  // 编辑模式
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadRound() {
      try {
        const res = await fetch(`/api/rounds/${roundId}`);
        if (res.ok) {
          const data = (await res.json()) as RoundDetail;
          setRound(data);
          if (data.recap_text) {
            setRecapText(data.recap_text);
          }
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
      setEditing(false);
    } catch {
      setError("Something went wrong while generating the recap.");
    } finally {
      setGenerating(false);
    }
  }, [roundId]);

  // URL 带 ?regenerate=1 时自动触发重新生成
  const autoRegenRef = useRef(false);
  useEffect(() => {
    if (shouldRegenerate && !loading && round && !autoRegenRef.current) {
      autoRegenRef.current = true;
      handleGenerate();
    }
  }, [shouldRegenerate, loading, round, handleGenerate]);

  // 保存编辑后的 recap
  const handleSaveEdit = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/rounds/${roundId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recap_text: editText }),
      });
      if (res.ok) {
        setRecapText(editText);
        setEditing(false);
      }
    } catch {
      setError("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }, [roundId, editText]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-secondary text-[0.9375rem]">Loading...</p>
      </div>
    );
  }

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

  // 已有 recap — 展示 / 编辑
  if (recapText) {
    return (
      <div className="flex flex-col gap-4">
        <Link href={`/rounds/${roundId}`}>
          <span className="text-accent text-[0.8125rem] font-medium hover:underline cursor-pointer">
            &larr; Back to round
          </span>
        </Link>

        {editing ? (
          <>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full min-h-[400px] rounded-lg border border-divider p-4 text-[0.9375rem] text-text leading-relaxed focus:border-accent focus:ring-1 focus:ring-accent outline-none resize-y"
            />
            <div className="flex gap-3">
              <Button onClick={handleSaveEdit} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button variant="secondary" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <>
            <RecapDisplay
              recapText={recapText}
              courseName={round.course_name ?? "Unknown Course"}
              teeName={round.tee_name ?? ""}
              playedDate={round.played_date}
            />
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditText(recapText);
                  setEditing(true);
                }}
              >
                Edit Recap
              </Button>
              <Button
                variant="ghost"
                onClick={handleGenerate}
              >
                Regenerate
              </Button>
            </div>
          </>
        )}

        {error && (
          <p className="text-red-600 text-[0.875rem]">{error}</p>
        )}
      </div>
    );
  }

  // 尚未生成
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

export default function RecapPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <p className="text-secondary text-[0.9375rem]">Loading...</p>
        </div>
      }
    >
      <RecapContent />
    </Suspense>
  );
}
