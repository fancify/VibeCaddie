"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { CourseTee } from "@/lib/db/types";

interface LookupHole {
  hole_number: number;
  par: number;
  yardage: number;
  si: number;
  hole_note?: string;
}

interface LookupTee {
  tee_name: string;
  tee_color: string;
  par_total: number;
  course_rating?: number;
  slope_rating?: number;
  holes: LookupHole[];
}

interface LookupResult {
  course_name: string;
  location: string;
  tees: LookupTee[];
  confidence: "high" | "medium" | "low";
  scorecard_source: "golfcourseapi";
  notes_source_url?: string;
}

type ImportState = "idle" | "searching" | "preview" | "saving";

interface TeeImportPanelProps {
  courseId: string;
  courseName: string;
  existingTees: CourseTee[];
  onImported: (newTee: CourseTee) => void;
  onCancel: () => void;
}

/** 在现有球场上搜索并导入一个新 tee（含所有洞数据） */
export function TeeImportPanel({
  courseId,
  courseName,
  existingTees,
  onImported,
  onCancel,
}: TeeImportPanelProps) {
  const [state, setState] = useState<ImportState>("idle");
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [availableTees, setAvailableTees] = useState<LookupTee[]>([]);
  const [selectedTee, setSelectedTee] = useState<LookupTee | null>(null);
  const [error, setError] = useState("");

  async function handleSearch() {
    setState("searching");
    setError("");
    setSelectedTee(null);

    try {
      const res = await fetch("/api/courses/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: courseName }),
      });

      if (!res.ok) {
        let errorMsg = "Search failed";
        try {
          const data = await res.json();
          errorMsg = data.error || errorMsg;
        } catch { /* empty body */ }
        throw new Error(errorMsg);
      }

      const text = await res.text();
      if (!text) throw new Error("Empty response from server. Please try again.");
      const data = JSON.parse(text) as LookupResult;
      setLookupResult(data);

      if (!data.tees || data.tees.length === 0) {
        throw new Error("No tee data found for this course.");
      }

      // 过滤掉已存在的 tee（不区分大小写）
      const existingNames = new Set(
        existingTees.map((t) => t.tee_name.toLowerCase())
      );
      const newTees = data.tees.filter(
        (t) => !existingNames.has(t.tee_name.toLowerCase())
      );

      if (newTees.length === 0) {
        throw new Error(
          "All tees from online data already exist in this course."
        );
      }

      setAvailableTees(newTees);
      setState("preview");
    } catch (err) {
      setError((err as Error).message);
      setState("idle");
    }
  }

  async function handleImport() {
    if (!selectedTee) return;
    setState("saving");
    setError("");

    try {
      // 创建 tee（含 course_rating / slope_rating）
      const teeBody: Record<string, unknown> = {
        tee_name: selectedTee.tee_name,
        tee_color: selectedTee.tee_color,
        par_total: selectedTee.par_total,
      };
      if (selectedTee.course_rating != null)
        teeBody.course_rating = selectedTee.course_rating;
      if (selectedTee.slope_rating != null)
        teeBody.slope_rating = selectedTee.slope_rating;

      const teeRes = await fetch(`/api/courses/${courseId}/tees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(teeBody),
      });

      if (!teeRes.ok) throw new Error("Failed to create tee");
      const createdTee = (await teeRes.json()) as CourseTee;

      // 批量 upsert holes（含 hole_note）
      const holesRes = await fetch(
        `/api/courses/${courseId}/tees/${createdTee.id}/holes`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            holes: selectedTee.holes.map((h) => ({
              hole_number: h.hole_number,
              par: h.par,
              yardage: h.yardage,
              si: h.si,
              hole_note: h.hole_note || undefined,
            })),
          }),
        }
      );

      if (!holesRes.ok) throw new Error("Failed to save hole data");

      onImported(createdTee);
    } catch (err) {
      setError((err as Error).message);
      setState("preview");
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 rounded-lg border border-divider bg-white">
      <div className="flex items-center justify-between">
        <p className="text-[0.9375rem] font-medium text-text">
          Search & Import Tee
        </p>
        <button
          onClick={onCancel}
          className="text-secondary hover:text-text text-[0.8125rem] cursor-pointer"
        >
          Cancel
        </button>
      </div>

      {state === "idle" && (
        <>
          <p className="text-[0.8125rem] text-secondary">
            Search online for tee data for{" "}
            <span className="font-medium text-text">{courseName}</span>. Tees
            already in this course will be filtered out.
          </p>
          <Button onClick={handleSearch}>Search Online</Button>
        </>
      )}

      {state === "searching" && (
        <p className="text-[0.8125rem] text-secondary animate-pulse">
          Searching... (may take 10s)
        </p>
      )}

      {state === "preview" && (
        <>
          <div className="flex flex-col gap-0.5">
            <p className="text-[0.8125rem] text-secondary">
              {availableTees.length} new tee
              {availableTees.length !== 1 ? "s" : ""} found. Select one to
              import:
            </p>
            <p className="text-[0.75rem] text-green-700">Scorecard: GolfCourseAPI ✓</p>
            <p className="text-[0.75rem] text-secondary">
              {lookupResult?.notes_source_url
                ? `Hole notes: ${lookupResult.notes_source_url}`
                : "Hole notes: not found"}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {availableTees.map((tee) => (
              <button
                key={tee.tee_name}
                onClick={() =>
                  setSelectedTee(
                    selectedTee?.tee_name === tee.tee_name ? null : tee
                  )
                }
                className={`
                  flex items-center justify-between rounded-lg border p-3 text-left
                  transition-colors cursor-pointer
                  ${
                    selectedTee?.tee_name === tee.tee_name
                      ? "border-accent bg-accent/5"
                      : "border-divider hover:border-accent/40"
                  }
                `}
              >
                <span className="text-[0.9375rem] font-medium text-text">
                  {tee.tee_name} Tee
                </span>
                <div className="flex items-center gap-3 text-[0.8125rem] text-secondary">
                  <span>Par {tee.par_total}</span>
                  {tee.course_rating != null && (
                    <span>CR {tee.course_rating}</span>
                  )}
                  {tee.slope_rating != null && (
                    <span>SL {tee.slope_rating}</span>
                  )}
                  <span>{tee.holes.length} holes</span>
                </div>
              </button>
            ))}
          </div>

          {selectedTee && (
            <div className="pt-2">
              <Button onClick={handleImport}>
                Import {selectedTee.tee_name} Tee
              </Button>
            </div>
          )}
        </>
      )}

      {state === "saving" && (
        <p className="text-[0.8125rem] text-secondary">Saving...</p>
      )}

      {error && <p className="text-[0.8125rem] text-red-500">{error}</p>}
    </div>
  );
}

