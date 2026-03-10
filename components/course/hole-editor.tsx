"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HoleRow } from "./hole-row";
import { Scorecard } from "./scorecard";
import type { CourseHole, HoleHazard, OfficialHoleNote } from "@/lib/db/types";

const TOTAL_HOLES = 18;

interface HoleState {
  par: number;
  yardage: number;
  si: number;
  /** 数据库中的 ID，未保存时为 null */
  holeId: string | null;
  hazards: HoleHazard[];
}

function defaultHoles(): HoleState[] {
  return Array.from({ length: TOTAL_HOLES }, () => ({
    par: 4,
    yardage: 0,
    si: 0,
    holeId: null,
    hazards: [],
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
  const [officialNotes, setOfficialNotes] = useState<Record<number, OfficialHoleNote>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  // 加载已有球洞数据 + 官方备注
  const loadHoles = useCallback(async () => {
    try {
      const [holesRes, notesRes] = await Promise.all([
        fetch(`/api/courses/${courseId}/tees/${teeId}/holes`),
        fetch(`/api/courses/${courseId}/official-notes`),
      ]);

      if (notesRes.ok) {
        const notes = (await notesRes.json()) as Record<number, OfficialHoleNote>;
        setOfficialNotes(notes);
      }

      if (!holesRes.ok) return;
      const dbHoles = (await holesRes.json()) as CourseHole[];
      if (dbHoles.length === 0) return;

      // 合并数据库数据到本地状态
      const merged = defaultHoles();
      for (const dh of dbHoles) {
        const idx = dh.hole_number - 1;
        if (idx >= 0 && idx < TOTAL_HOLES) {
          merged[idx] = {
            par: dh.par,
            yardage: dh.yardage,
            si: (dh as CourseHole & { si?: number }).si ?? 0,
            holeId: dh.id,
            hazards: [],
          };
        }
      }

      // 并行加载所有球洞的障碍物
      const hazardPromises = merged.map(async (h) => {
        if (!h.holeId) return [];
        try {
          const hRes = await fetch(`/api/courses/holes/${h.holeId}/hazards`);
          if (hRes.ok) return (await hRes.json()) as HoleHazard[];
        } catch {
          // 加载失败返回空
        }
        return [];
      });

      const allHazards = await Promise.all(hazardPromises);
      for (let i = 0; i < merged.length; i++) {
        merged[i].hazards = allHazards[i];
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

  // Save All：批量 upsert
  async function handleSave() {
    setSaving(true);
    setFeedback("");

    try {
      const payload = holes.map((h, i) => ({
        hole_number: i + 1,
        par: h.par,
        yardage: h.yardage,
        si: h.si || undefined,
      }));

      const res = await fetch(`/api/courses/${courseId}/tees/${teeId}/holes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holes: payload }),
      });

      if (res.ok) {
        const saved = (await res.json()) as CourseHole[];
        // 更新本地 holeId（用于后续添加障碍物）
        setHoles((prev) => {
          const next = [...prev];
          for (const s of saved) {
            const idx = s.hole_number - 1;
            if (idx >= 0 && idx < TOTAL_HOLES) {
              next[idx] = { ...next[idx], holeId: s.id };
            }
          }
          return next;
        });
        setFeedback("Saved!");
      } else {
        setFeedback("Failed to save. Please try again.");
      }
    } catch {
      setFeedback("Network error. Please try again.");
    } finally {
      setSaving(false);
      setTimeout(() => setFeedback(""), 3000);
    }
  }

  // 更新单个洞
  function handleHoleChange(
    index: number,
    data: { par: number; yardage: number; si: number }
  ) {
    setHoles((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...data };
      return next;
    });
  }

  // 更新单个洞的障碍物
  function handleHazardsChange(index: number, hazards: HoleHazard[]) {
    setHoles((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], hazards };
      return next;
    });
  }

  // 官方备注保存后更新本地状态
  function handleOfficialNoteSave(holeNumber: number, note: OfficialHoleNote | null) {
    setOfficialNotes((prev) => {
      if (!note) {
        const next = { ...prev };
        delete next[holeNumber];
        return next;
      }
      return { ...prev, [holeNumber]: note };
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
            holeId={hole.holeId}
            hazards={hole.hazards}
            courseId={courseId}
            officialNote={officialNotes[i + 1] ?? null}
            onChange={(data) => handleHoleChange(i, data)}
            onHazardsChange={(hazards) => handleHazardsChange(i, hazards)}
            onOfficialNoteSave={(note) => handleOfficialNoteSave(i + 1, note)}
          />
        ))}
      </Card>

      {/* 底部操作 */}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
        {onFinish && (
          <Button onClick={onFinish}>
            Finish
          </Button>
        )}
      </div>
    </div>
  );
}
