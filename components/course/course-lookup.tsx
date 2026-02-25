"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/section-title";
import { Card } from "@/components/ui/card";
import type { Course, CourseTee } from "@/lib/db/types";

// ---------- Types ----------

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
  selected: boolean; // 用户是否选择保存此 tee
}

interface LookupResult {
  course_name: string;
  location: string;
  tees: LookupTee[];
  confidence: "high" | "medium" | "low";
  scorecard_source: "golfcourseapi";
  notes_source_url?: string;
}

type LookupState = "idle" | "searching" | "preview" | "saving";

// ---------- Confidence Badge ----------

const CONFIDENCE_STYLES = {
  high: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-red-100 text-red-800",
} as const;

function ConfidenceBadge({ level }: { level: LookupResult["confidence"] }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-[0.75rem] font-medium ${CONFIDENCE_STYLES[level]}`}
    >
      {level === "high" ? "High confidence" : level === "medium" ? "Medium confidence" : "Low — review carefully"}
    </span>
  );
}

// ---------- Editable Cell ----------

function EditableCell({
  value,
  onChange,
  className = "",
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = parseInt(draft, 10);
          if (!isNaN(n) && n > 0) onChange(n);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setEditing(false);
        }}
        className={`w-10 text-center border-b border-accent bg-transparent outline-none text-[0.75rem] ${className}`}
      />
    );
  }

  return (
    <span
      onClick={() => {
        setDraft(String(value));
        setEditing(true);
      }}
      className={`cursor-pointer hover:bg-accent/10 rounded px-0.5 ${className}`}
      title="Click to edit"
    >
      {value}
    </span>
  );
}

// ---------- Editable Scorecard Table ----------

function EditableScorecardTable({
  tee,
  onHoleChange,
}: {
  tee: LookupTee;
  onHoleChange: (holeNum: number, field: keyof LookupHole, value: number) => void;
}) {
  const front9 = tee.holes.filter((h) => h.hole_number <= 9);
  const back9 = tee.holes.filter((h) => h.hole_number > 9);

  const renderHalf = (holes: LookupHole[], label: string) => {
    const totalPar = holes.reduce((s, h) => s + h.par, 0);
    const totalYds = holes.reduce((s, h) => s + h.yardage, 0);
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-[0.75rem] border-collapse">
          <thead>
            <tr className="bg-bg">
              <th className="px-1.5 py-1 text-left font-medium text-secondary border-b border-divider">
                {label}
              </th>
              {holes.map((h) => (
                <th
                  key={h.hole_number}
                  className="px-1.5 py-1 text-center font-medium text-secondary border-b border-divider min-w-[2rem]"
                >
                  {h.hole_number}
                </th>
              ))}
              <th className="px-1.5 py-1 text-center font-semibold text-text border-b border-divider">
                Tot
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-1.5 py-1 font-medium text-secondary border-b border-divider">Par</td>
              {holes.map((h) => (
                <td key={h.hole_number} className="px-1.5 py-1 text-center border-b border-divider">
                  <EditableCell value={h.par} onChange={(v) => onHoleChange(h.hole_number, "par", v)} />
                </td>
              ))}
              <td className="px-1.5 py-1 text-center font-semibold border-b border-divider">{totalPar}</td>
            </tr>
            <tr>
              <td className="px-1.5 py-1 font-medium text-secondary border-b border-divider">Yds</td>
              {holes.map((h) => (
                <td key={h.hole_number} className="px-1.5 py-1 text-center border-b border-divider">
                  <EditableCell value={h.yardage} onChange={(v) => onHoleChange(h.hole_number, "yardage", v)} />
                </td>
              ))}
              <td className="px-1.5 py-1 text-center font-semibold border-b border-divider">{totalYds}</td>
            </tr>
            <tr>
              <td className="px-1.5 py-1 font-medium text-secondary">SI</td>
              {holes.map((h) => (
                <td key={h.hole_number} className="px-1.5 py-1 text-center">
                  <EditableCell value={h.si} onChange={(v) => onHoleChange(h.hole_number, "si", v)} />
                </td>
              ))}
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {renderHalf(front9, "Out")}
      {renderHalf(back9, "In")}
    </div>
  );
}

// ---------- Main Component ----------

/** 在线搜索球场记分卡 → 可编辑预览 → 查重 → 保存/合并 */
export function CourseLookup() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [state, setState] = useState<LookupState>("idle");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState("");

  // 查重状态
  const [duplicates, setDuplicates] = useState<Course[] | null>(null);
  // 已有 course 的 tee（用于 merge 时去重）
  const [existingTees, setExistingTees] = useState<CourseTee[]>([]);
  // 选择合并的目标 course
  const [mergeTarget, setMergeTarget] = useState<Course | null>(null);

  // ---- 搜索 ----
  async function handleSearch() {
    if (!name.trim()) {
      setError("Please enter a course name.");
      return;
    }

    setError("");
    setResult(null);
    setDuplicates(null);
    setMergeTarget(null);
    setState("searching");

    try {
      const res = await fetch("/api/courses/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          location: location.trim() || undefined,
        }),
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
      const data = JSON.parse(text);

      if (!data.tees || data.tees.length === 0) {
        throw new Error("No tee data found for this course.");
      }

      // 给每个 tee 加 selected 标记
      const tees = data.tees.map((t: LookupTee) => ({ ...t, selected: true }));
      setResult({ ...data, tees });
      setState("preview");
    } catch (err) {
      setError((err as Error).message);
      setState("idle");
    }
  }

  // ---- 编辑洞数据 ----
  function handleHoleChange(teeIdx: number, holeNum: number, field: keyof LookupHole, value: number) {
    if (!result) return;
    setResult({
      ...result,
      tees: result.tees.map((tee, i) => {
        if (i !== teeIdx) return tee;
        const holes = tee.holes.map((h) =>
          h.hole_number === holeNum ? { ...h, [field]: value } : h
        );
        return { ...tee, holes, par_total: holes.reduce((s, h) => s + h.par, 0) };
      }),
    });
  }

  // ---- 切换 tee 选中 ----
  function toggleTee(teeIdx: number) {
    if (!result) return;
    setResult({
      ...result,
      tees: result.tees.map((tee, i) =>
        i === teeIdx ? { ...tee, selected: !tee.selected } : tee
      ),
    });
  }

  // ---- 选择合并到已有 course ----
  async function handleSelectMerge(course: Course) {
    setMergeTarget(course);
    setDuplicates(null);
    // 获取已有 tee 列表用于去重
    try {
      const res = await fetch(`/api/courses/${course.id}/tees`);
      if (res.ok) {
        const tees = (await res.json()) as CourseTee[];
        setExistingTees(tees);
        // 自动反选已存在的 tee
        if (result) {
          setResult({
            ...result,
            tees: result.tees.map((t) => ({
              ...t,
              selected: !tees.some(
                (et) => et.tee_name.toLowerCase() === t.tee_name.toLowerCase()
              ),
            })),
          });
        }
      }
    } catch {
      // 获取失败不影响
    }
  }

  // ---- 保存 ----
  async function handleSave(forceNew = false) {
    if (!result) return;

    const selectedTees = result.tees.filter((t) => t.selected);
    if (selectedTees.length === 0) {
      setError("Please select at least one tee to save.");
      return;
    }

    setState("saving");
    setError("");

    try {
      let courseId: string;

      if (mergeTarget && !forceNew) {
        // 合并到已有 course
        courseId = mergeTarget.id;
      } else {
        // 创建新 course（带查重）
        const courseRes = await fetch("/api/courses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: result.course_name,
            location_text: result.location || undefined,
            force: forceNew,
          }),
        });

        if (courseRes.status === 409) {
          // 发现重复
          const data = await courseRes.json();
          setDuplicates(data.duplicates as Course[]);
          setState("preview");
          return;
        }

        if (!courseRes.ok) throw new Error("Failed to create course");
        const course = (await courseRes.json()) as Course;
        courseId = course.id;
      }

      // 创建选中的 tee + holes
      for (const tee of selectedTees) {
        const teeBody: Record<string, unknown> = {
          tee_name: tee.tee_name,
          tee_color: tee.tee_color,
          par_total: tee.par_total,
        };
        if (tee.course_rating != null) teeBody.course_rating = tee.course_rating;
        if (tee.slope_rating != null) teeBody.slope_rating = tee.slope_rating;

        const teeRes = await fetch(`/api/courses/${courseId}/tees`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(teeBody),
        });

        if (!teeRes.ok) throw new Error(`Failed to create ${tee.tee_name} tee`);
        const createdTee = (await teeRes.json()) as CourseTee;

        // 批量 upsert holes（含 hole_note）
        const holesRes = await fetch(
          `/api/courses/${courseId}/tees/${createdTee.id}/holes`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              holes: tee.holes.map((h) => ({
                hole_number: h.hole_number,
                par: h.par,
                yardage: h.yardage,
                si: h.si,
                hole_note: h.hole_note || undefined,
              })),
            }),
          },
        );

        if (!holesRes.ok) throw new Error(`Failed to save holes for ${tee.tee_name} tee`);
      }

      router.push(`/courses/${courseId}`);
    } catch (err) {
      setError((err as Error).message);
      setState("preview");
    }
  }

  // ---- 重新搜索 ----
  function handleReset() {
    setResult(null);
    setError("");
    setDuplicates(null);
    setMergeTarget(null);
    setExistingTees([]);
    setState("idle");
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 搜索输入 */}
      {(state === "idle" || state === "searching") && (
        <>
          <div className="flex flex-col gap-4">
            <Input
              label="Course Name"
              value={name}
              onChange={setName}
              placeholder="e.g. Sudbury Golf Club"
            />
            <Input
              label="Location (optional)"
              value={location}
              onChange={setLocation}
              placeholder="e.g. Suffolk, England"
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={state === "searching"}
          >
            {state === "searching" ? "Searching... (may take 15s)" : "Search Online"}
          </Button>
        </>
      )}

      {/* 预览 */}
      {state === "preview" && result && (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <h2 className="text-[1.25rem] font-semibold text-text">
                {result.course_name}
              </h2>
              <ConfidenceBadge level={result.confidence} />
            </div>
            {result.location && (
              <p className="text-[0.875rem] text-secondary">{result.location}</p>
            )}
            {/* 数据来源标签 */}
            <div className="flex flex-col gap-0.5">
              <p className="text-[0.75rem] text-green-700">
                Scorecard: GolfCourseAPI ✓
              </p>
              <p className="text-[0.75rem] text-secondary">
                {result.notes_source_url
                  ? `Hole notes: ${result.notes_source_url}`
                  : "Hole notes: not found"}
              </p>
            </div>
            {mergeTarget && (
              <p className="text-[0.8125rem] text-accent font-medium">
                Adding tees to: {mergeTarget.name}
              </p>
            )}
            <p className="text-[0.75rem] text-secondary">
              Tap any value to edit before saving.
            </p>
          </div>

          {/* 查重警告 */}
          {duplicates && (
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
                <p className="text-[0.9375rem] font-medium text-yellow-800">
                  Similar courses found
                </p>
                <p className="text-[0.8125rem] text-yellow-700 mt-1">
                  Add tees to an existing course, or create a new one.
                </p>
              </div>
              {duplicates.map((course) => (
                <Card key={course.id} className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[0.9375rem] font-medium text-text">{course.name}</span>
                    {course.location_text && (
                      <span className="text-[0.8125rem] text-secondary">{course.location_text}</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleSelectMerge(course)}
                    className="text-[0.8125rem] text-accent font-medium hover:underline ml-4 whitespace-nowrap cursor-pointer"
                  >
                    Add tees here
                  </button>
                </Card>
              ))}
              <Button variant="secondary" onClick={() => handleSave(true)}>
                Create new course anyway
              </Button>
            </div>
          )}

          <SectionTitle>
            Tees {mergeTarget ? "(select tees to add)" : ""}
          </SectionTitle>

          {/* 已有 tee 提示 */}
          {existingTees.length > 0 && (
            <p className="text-[0.8125rem] text-secondary -mt-3">
              Existing tees: {existingTees.map((t) => t.tee_name).join(", ")}
            </p>
          )}

          {/* 可编辑的 tee 列表 */}
          <div className="flex flex-col gap-4">
            {result.tees.map((tee, teeIdx) => {
              const alreadyExists = existingTees.some(
                (et) => et.tee_name.toLowerCase() === tee.tee_name.toLowerCase()
              );
              return (
                <div
                  key={tee.tee_name}
                  className={`rounded-lg border p-4 transition-opacity ${
                    tee.selected ? "border-divider bg-white" : "border-divider/50 bg-gray-50 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tee.selected}
                        onChange={() => toggleTee(teeIdx)}
                        className="w-4 h-4 accent-accent"
                      />
                      <span className="text-[0.9375rem] font-semibold text-text">
                        {tee.tee_name} Tee
                      </span>
                      {alreadyExists && (
                        <span className="text-[0.6875rem] text-yellow-700 bg-yellow-100 rounded px-1.5 py-0.5">
                          already exists
                        </span>
                      )}
                    </label>
                    <div className="flex items-center gap-2 text-[0.8125rem] text-secondary">
                      <span>Par {tee.par_total}</span>
                      {tee.course_rating != null && <span>CR {tee.course_rating}</span>}
                      {tee.slope_rating != null && <span>SL {tee.slope_rating}</span>}
                      <span>{tee.holes.length} holes</span>
                    </div>
                  </div>
                  {tee.selected && (
                    <EditableScorecardTable
                      tee={tee}
                      onHoleChange={(holeNum, field, value) =>
                        handleHoleChange(teeIdx, holeNum, field, value)
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>

          {result.confidence === "low" && (
            <p className="text-[0.8125rem] text-yellow-700 bg-yellow-50 rounded-lg p-3">
              Low confidence — please review and edit values before saving.
            </p>
          )}

          {!duplicates && (
            <div className="flex gap-3">
              <Button onClick={() => handleSave(false)}>
                {mergeTarget ? "Add Selected Tees" : "Save Course"}
              </Button>
              <Button variant="secondary" onClick={handleReset}>
                Search Again
              </Button>
            </div>
          )}
        </>
      )}

      {/* 保存中 */}
      {state === "saving" && (
        <p className="text-[0.9375rem] text-secondary">
          Saving...
        </p>
      )}

      {/* 错误 */}
      {error && (
        <p className="text-[0.8125rem] text-red-500">{error}</p>
      )}
    </div>
  );
}


