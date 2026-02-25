"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HoleRow } from "./hole-row";
import { Scorecard } from "./scorecard";
import type { CourseHole } from "@/lib/db/types";

const TOTAL_HOLES = 18;

interface HoleState {
  par: number;
  yardage: number;
  si: number;
  holeNote: string;
}

function defaultHoles(): HoleState[] {
  return Array.from({ length: TOTAL_HOLES }, () => ({
    par: 4,
    yardage: 0,
    si: 0,
    holeNote: "",
  }));
}

interface HoleEditorProps {
  courseId: string;
  teeId: string;
  onFinish?: () => void;
}

/** 球洞编辑器：18洞列表 + Save All */
export function HoleEditor({ courseId, teeId, onFinish }: HoleEditorProps) {
  const [holes, setHoles] = useState<HoleState[]>(defaultHoles);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  const loadHoles = useCallback(async () => {
    try {
      const res = await fetch(`/api/courses/${courseId}/tees/${teeId}/holes`);
      if (!res.ok) return;

      const dbHoles = (await res.json()) as CourseHole[];
      if (dbHoles.length === 0) return;

      const merged = defaultHoles();
      for (const dh of dbHoles) {
        const idx = dh.hole_number - 1;
        if (idx >= 0 && idx < TOTAL_HOLES) {
          merged[idx] = {
            par: dh.par,
            yardage: dh.yardage,
            si: (dh as CourseHole & { si?: number }).si ?? 0,
            holeNote: dh.hole_note ?? "",
          };
        }
      }

      setHoles(merged);
    } catch {
      // 加载失败保持默认
    } finally {
      setLoading(false);
    }
  }, [courseId, teeId]);

  useEffect(() => {
    loadHoles();
  }, [loadHoles]);

  async function handleSave(): Promise<boolean> {
    setSaving(true);
    setFeedback("");

    try {
      const payload = holes.map((h, i) => ({
        hole_number: i + 1,
        par: h.par,
        yardage: h.yardage,
        si: h.si || undefined,
        hole_note: h.holeNote || undefined,
      }));

      const res = await fetch(`/api/courses/${courseId}/tees/${teeId}/holes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holes: payload }),
      });

      if (res.ok) {
        setFeedback("Saved!");
        return true;
      } else {
        setFeedback("Failed to save. Please try again.");
        return false;
      }
    } catch {
      setFeedback("Network error. Please try again.");
      return false;
    } finally {
      setSaving(false);
      setTimeout(() => setFeedback(""), 3000);
    }
  }

  async function handleFinish() {
    const success = await handleSave();
    if (success) onFinish?.();
  }

  function handleHoleChange(
    index: number,
    data: { par: number; yardage: number; si: number; holeNote: string }
  ) {
    setHoles((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...data };
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-secondary text-[0.9375rem]">Loading holes...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 记分卡汇总 */}
      <Scorecard holes={holes} />

      {/* 反馈消息 */}
      {feedback && (
        <p
          className={`text-[0.8125rem] ${
            feedback.includes("Saved") ? "text-accent" : "text-red-500"
          }`}
        >
          {feedback}
        </p>
      )}

      {/* 球洞列表 */}
      <Card className="!p-3">
        {holes.map((hole, i) => (
          <HoleRow
            key={i}
            holeNumber={i + 1}
            par={hole.par}
            yardage={hole.yardage}
            si={hole.si}
            holeNote={hole.holeNote}
            onChange={(data) => handleHoleChange(i, data)}
          />
        ))}
      </Card>

      {/* 底部操作 */}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
        {onFinish && (
          <Button onClick={handleFinish} disabled={saving}>
            Finish
          </Button>
        )}
      </div>
    </div>
  );
}
