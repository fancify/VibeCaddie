"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/section-title";
import { InfoBanner } from "@/components/ui/info-banner";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TeeImportPanel } from "@/components/course/tee-import-panel";
import type { Course, CourseTee } from "@/lib/db/types";

const TEE_OPTIONS = [
  { value: "", label: "Select tee" },
  { value: "White", label: "White Tee" },
  { value: "Yellow", label: "Yellow Tee" },
  { value: "Blue", label: "Blue Tee" },
  { value: "Red", label: "Red Tee" },
  { value: "Gold", label: "Gold Tee" },
  { value: "Black", label: "Black Tee" },
];

/** tee 颜色对应的圆点色 */
const COLOR_MAP: Record<string, string> = {
  White: "bg-gray-200",
  Yellow: "bg-yellow-400",
  Blue: "bg-blue-500",
  Red: "bg-red-500",
  Gold: "bg-amber-500",
  Black: "bg-gray-800",
};

interface CourseDetail extends Course {
  tees: CourseTee[];
}

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = params.courseId as string;
  const justFinished = searchParams.get("done") === "1";
  const finishedCourseName = searchParams.get("course") ?? "";

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [golferName, setGolferName] = useState("");

  // 编辑球场名称
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // 编辑 tee par_total
  const [editingTeeId, setEditingTeeId] = useState<string | null>(null);
  const [editTeePar, setEditTeePar] = useState("");
  const [savingTee, setSavingTee] = useState(false);
  const [deletingTeeId, setDeletingTeeId] = useState<string | null>(null);

  // 添加 / 导入 tee 的面板状态
  const [showAddTee, setShowAddTee] = useState(false);
  const [showImportTee, setShowImportTee] = useState(false);
  const [teeColor, setTeeColor] = useState("");
  const [parTotal, setParTotal] = useState("");
  const [courseRating, setCourseRating] = useState("");
  const [slopeRating, setSlopeRating] = useState("");
  const [addingTee, setAddingTee] = useState(false);
  const [teeError, setTeeError] = useState("");


  useEffect(() => {
    async function load() {
      try {
        const [courseRes, profileRes] = await Promise.all([
          fetch(`/api/courses/${courseId}`),
          justFinished ? fetch("/api/profile") : Promise.resolve(null),
        ]);

        if (courseRes.ok) {
          const data = (await courseRes.json()) as CourseDetail;
          setCourse(data);
        } else if (courseRes.status === 404) {
          router.push("/courses");
        }

        if (profileRes?.ok) {
          const profile = await profileRes.json();
          setGolferName(profile.name ?? "");
        }
      } catch {
        setFetchError("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [courseId, router, justFinished]);

  async function handleAddTee() {
    setTeeError("");
    if (!teeColor) {
      setTeeError("Pick a tee color.");
      return;
    }
    const par = parseInt(parTotal, 10);
    if (!par || par < 1) {
      setTeeError("Valid par total is required.");
      return;
    }

    setAddingTee(true);
    try {
      const body: Record<string, unknown> = {
        tee_name: teeColor,
        tee_color: teeColor,
        par_total: par,
      };
      const cr = parseFloat(courseRating);
      const sl = parseInt(slopeRating, 10);
      if (!isNaN(cr) && cr > 0) body.course_rating = cr;
      if (!isNaN(sl) && sl > 0) body.slope_rating = sl;

      const res = await fetch(`/api/courses/${courseId}/tees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const newTee = (await res.json()) as CourseTee;
        setCourse((prev) =>
          prev ? { ...prev, tees: [...prev.tees, newTee] } : prev
        );
        setTeeColor("");
        setParTotal("");
        setCourseRating("");
        setSlopeRating("");
        setShowAddTee(false);
      } else {
        setTeeError("Failed to add tee.");
      }
    } catch {
      setTeeError("Something went wrong.");
    } finally {
      setAddingTee(false);
    }
  }

  // 保存球场名称
  const handleSaveName = useCallback(async () => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === course?.name) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        const updated = (await res.json()) as Course;
        setCourse((prev) => prev ? { ...prev, name: updated.name } : prev);
      }
    } catch { /* 静默 */ }
    setSavingName(false);
    setEditingName(false);
  }, [editName, course?.name, courseId]);

  // 保存 tee par_total
  const handleSaveTeePar = useCallback(async (teeId: string) => {
    const par = parseInt(editTeePar, 10);
    if (!par || par < 1) {
      setEditingTeeId(null);
      return;
    }
    setSavingTee(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/tees/${teeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ par_total: par }),
      });
      if (res.ok) {
        const updated = (await res.json()) as CourseTee;
        setCourse((prev) =>
          prev
            ? { ...prev, tees: prev.tees.map((t) => (t.id === teeId ? updated : t)) }
            : prev
        );
      }
    } catch { /* 静默 */ }
    setSavingTee(false);
    setEditingTeeId(null);
  }, [editTeePar, courseId]);

  // 删除 tee
  const handleDeleteTee = useCallback(async (teeId: string, teeName: string) => {
    if (!confirm(`Delete "${teeName} Tee" and all its hole data? This cannot be undone.`)) return;
    setDeletingTeeId(teeId);
    try {
      const res = await fetch(`/api/courses/${courseId}/tees/${teeId}`, { method: "DELETE" });
      if (res.ok) {
        setCourse((prev) =>
          prev ? { ...prev, tees: prev.tees.filter((t) => t.id !== teeId) } : prev
        );
      }
    } catch { /* 静默 */ }
    setDeletingTeeId(null);
  }, [courseId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-secondary text-[0.9375rem]">Loading...</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-secondary text-[0.9375rem]">
          {fetchError || "Course not found."}
        </p>
        <Link href="/courses">
          <span className="text-accent text-[0.9375rem] font-medium hover:underline cursor-pointer">
            Back to courses
          </span>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 完成感谢 */}
      {justFinished && (
        <div className="rounded-lg bg-accent/10 border border-accent/20 px-5 py-4">
          <p className="text-[1.125rem] font-semibold text-accent">
            Nice one{golferName ? `, ${golferName}` : ""}!
          </p>
          <p className="text-[0.875rem] text-text mt-1">
            {finishedCourseName
              ? `${finishedCourseName} is looking better already.`
              : "Course info saved."}{" "}
            Every detail you add helps the whole crew play smarter.
          </p>
        </div>
      )}

      {/* 返回链接 */}
      <Link
        href="/courses"
        className="text-[0.8125rem] text-accent hover:underline self-start"
      >
        &larr; All courses
      </Link>

      {/* 球场名称和位置 — 可点击编辑 */}
      <div>
        {editingName ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              className="text-[1.5rem] font-semibold text-text border-b-2 border-accent bg-transparent outline-none flex-1 min-w-0"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveName();
                if (e.key === "Escape") setEditingName(false);
              }}
              disabled={savingName}
            />
            <button
              onClick={handleSaveName}
              disabled={savingName}
              className="text-[0.8125rem] text-accent font-medium hover:underline cursor-pointer"
            >
              {savingName ? "..." : "Save"}
            </button>
            <button
              onClick={() => setEditingName(false)}
              className="text-[0.8125rem] text-secondary hover:underline cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : (
          <h1
            className="text-[1.875rem] font-semibold text-text group cursor-pointer"
            onClick={() => {
              setEditName(course.name);
              setEditingName(true);
            }}
            title="Click to edit"
          >
            {course.name}
            <svg className="inline-block w-4 h-4 ml-2 text-secondary opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </h1>
        )}
        {course.location_text && (
          <p className="text-[0.9375rem] text-secondary mt-1">
            {course.location_text}
          </p>
        )}
      </div>

      {/* 协作说明 */}
      <InfoBanner>
        Shared course — anyone who plays here can add tees, fill in hole
        details, and mark hazards. The more players contribute, the smarter
        your caddie plan becomes.
      </InfoBanner>

      {/* 球场笔记 */}
      {course.course_note && (
        <Card>
          <p className="text-[0.9375rem] text-text">{course.course_note}</p>
        </Card>
      )}

      {/* Tee 列表 */}
      <div className="flex flex-col gap-3">
        <SectionTitle>Tees</SectionTitle>
        <p className="text-[0.8125rem] text-secondary -mt-1">
          Add the tees you play. Others can add theirs too.
        </p>
        {course.tees.length === 0 && (
          <p className="text-[0.9375rem] text-secondary italic">
            No tees added yet — be the first.
          </p>
        )}
        {course.tees.map((tee) => (
          <Card
            key={tee.id}
            className="flex items-center justify-between cursor-pointer hover:border-accent/40 transition-colors"
            onClick={() =>
              router.push(`/courses/${courseId}/tees/${tee.id}/holes`)
            }
          >
            <div className="flex items-center gap-3">
              {tee.tee_color && COLOR_MAP[tee.tee_color] && (
                <span
                  className={`w-3 h-3 rounded-full ${COLOR_MAP[tee.tee_color]}`}
                />
              )}
              <div className="flex flex-col">
                <span className="text-[0.9375rem] font-medium text-text">
                  {tee.tee_name} Tee
                </span>
                {editingTeeId === tee.id ? (
                  <div
                    className="flex items-center gap-1.5 mt-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-[0.8125rem] text-secondary">Par</span>
                    <input
                      autoFocus
                      type="number"
                      className="w-14 text-[0.8125rem] text-text border-b border-accent bg-transparent outline-none"
                      value={editTeePar}
                      onChange={(e) => setEditTeePar(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveTeePar(tee.id);
                        if (e.key === "Escape") setEditingTeeId(null);
                      }}
                      disabled={savingTee}
                    />
                    <button
                      onClick={() => handleSaveTeePar(tee.id)}
                      disabled={savingTee}
                      className="text-[0.75rem] text-accent font-medium cursor-pointer"
                    >
                      {savingTee ? "..." : "OK"}
                    </button>
                  </div>
                ) : (
                  <span
                    className="text-[0.8125rem] text-secondary group/par inline-flex items-center gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditTeePar(String(tee.par_total));
                      setEditingTeeId(tee.id);
                    }}
                    title="Click to edit par"
                  >
                    Par {tee.par_total}
                    {tee.course_rating != null && tee.slope_rating != null && (
                      <span className="ml-1 text-secondary/60">
                        · CR {tee.course_rating} / SL {tee.slope_rating}
                      </span>
                    )}
                    <svg className="w-3 h-3 text-secondary/50 opacity-0 group-hover/par:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[0.8125rem] text-accent font-medium">
                Holes &rarr;
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteTee(tee.id, tee.tee_name);
                }}
                disabled={deletingTeeId === tee.id}
                className="text-secondary hover:text-red-500 transition-colors cursor-pointer p-1"
                title="Delete tee"
              >
                {deletingTeeId === tee.id ? (
                  <span className="text-[0.75rem]">...</span>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            </div>
          </Card>
        ))}
      </div>

      {/* 添加 / 导入 Tee */}
      {showAddTee ? (
        <div className="flex flex-col gap-3 p-4 rounded-lg border border-divider bg-white">
          <SectionTitle>Add a Tee</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Tee"
              value={teeColor}
              onChange={setTeeColor}
              options={TEE_OPTIONS}
              placeholder="Select tee"
            />
            <Input
              label="Par Total"
              type="number"
              value={parTotal}
              onChange={setParTotal}
              placeholder="e.g. 72"
            />
            <Input
              label="Course Rating (optional)"
              type="number"
              value={courseRating}
              onChange={setCourseRating}
              placeholder="e.g. 71.5"
            />
            <Input
              label="Slope Rating (optional)"
              type="number"
              value={slopeRating}
              onChange={setSlopeRating}
              placeholder="e.g. 130"
            />
          </div>
          {teeError && (
            <p className="text-[0.8125rem] text-red-500">{teeError}</p>
          )}
          <div className="flex gap-3">
            <Button onClick={handleAddTee} disabled={addingTee}>
              {addingTee ? "Adding..." : "Add Tee"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setShowAddTee(false);
                setTeeError("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : showImportTee ? (
        <TeeImportPanel
          courseId={courseId}
          courseName={course.name}
          existingTees={course.tees}
          onImported={(newTee) => {
            setCourse((prev) =>
              prev ? { ...prev, tees: [...prev.tees, newTee] } : prev
            );
            setShowImportTee(false);
          }}
          onCancel={() => setShowImportTee(false)}
        />
      ) : (
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setShowAddTee(true)}>
            + Add Tee
          </Button>
          <Button variant="secondary" onClick={() => setShowImportTee(true)}>
            Search &amp; Import Tee
          </Button>
        </div>
      )}

      {/* 计划一轮的快捷入口 */}
      {course.tees.length > 0 && (
        <Link href={`/briefing?courseId=${courseId}`}>
          <Button variant="secondary" className="w-full">
            Plan a Round Here
          </Button>
        </Link>
      )}
    </div>
  );
}
