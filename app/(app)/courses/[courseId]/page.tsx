"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/section-title";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Course, CourseTee } from "@/lib/db/types";

const TEE_COLORS = [
  { value: "", label: "Select color" },
  { value: "White", label: "White" },
  { value: "Blue", label: "Blue" },
  { value: "Red", label: "Red" },
  { value: "Gold", label: "Gold" },
  { value: "Black", label: "Black" },
];

/** tee 颜色对应的圆点色 */
const COLOR_MAP: Record<string, string> = {
  White: "bg-gray-200",
  Blue: "bg-blue-500",
  Red: "bg-red-500",
  Gold: "bg-yellow-400",
  Black: "bg-gray-800",
};

interface CourseDetail extends Course {
  tees: CourseTee[];
}

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  // 添加 tee 的表单状态
  const [showAddTee, setShowAddTee] = useState(false);
  const [teeName, setTeeName] = useState("");
  const [teeColor, setTeeColor] = useState("");
  const [parTotal, setParTotal] = useState("");
  const [addingTee, setAddingTee] = useState(false);
  const [teeError, setTeeError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/courses/${courseId}`);
        if (res.ok) {
          const data = (await res.json()) as CourseDetail;
          setCourse(data);
        } else if (res.status === 404) {
          router.push("/courses");
        }
      } catch {
        setFetchError("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [courseId, router]);

  async function handleAddTee() {
    setTeeError("");
    if (!teeName.trim()) {
      setTeeError("Tee name is required.");
      return;
    }
    const par = parseInt(parTotal, 10);
    if (!par || par < 1) {
      setTeeError("Valid par total is required.");
      return;
    }

    setAddingTee(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/tees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tee_name: teeName.trim(),
          tee_color: teeColor || undefined,
          par_total: par,
        }),
      });

      if (res.ok) {
        const newTee = (await res.json()) as CourseTee;
        setCourse((prev) =>
          prev ? { ...prev, tees: [...prev.tees, newTee] } : prev
        );
        // 重置表单
        setTeeName("");
        setTeeColor("");
        setParTotal("");
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
      {/* 球场名称和位置 */}
      <div>
        <h1 className="text-[1.875rem] font-semibold text-text">
          {course.name}
        </h1>
        {course.location_text && (
          <p className="text-[0.9375rem] text-secondary mt-1">
            {course.location_text}
          </p>
        )}
      </div>

      {/* 球场笔记 */}
      {course.course_note && (
        <Card>
          <p className="text-[0.9375rem] text-text">{course.course_note}</p>
        </Card>
      )}

      {/* Tee 列表 */}
      <div className="flex flex-col gap-3">
        <SectionTitle>Tees</SectionTitle>
        {course.tees.length === 0 && (
          <p className="text-[0.9375rem] text-secondary">
            No tees added yet.
          </p>
        )}
        {course.tees.map((tee) => (
          <Card key={tee.id} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {tee.tee_color && COLOR_MAP[tee.tee_color] && (
                <span
                  className={`w-3 h-3 rounded-full ${COLOR_MAP[tee.tee_color]}`}
                />
              )}
              <div className="flex flex-col">
                <span className="text-[0.9375rem] font-medium text-text">
                  {tee.tee_name}
                </span>
                <span className="text-[0.8125rem] text-secondary">
                  Par {tee.par_total}
                </span>
              </div>
            </div>
            {/* Edit Holes 链接（Task 8 会创建该页面） */}
            <button
              onClick={() =>
                router.push(`/courses/${courseId}/tees/${tee.id}/holes`)
              }
              className="text-[0.8125rem] text-accent font-medium hover:underline cursor-pointer"
            >
              Edit Holes
            </button>
          </Card>
        ))}
      </div>

      {/* 添加 Tee */}
      {/* 创建 Briefing 快捷入口 */}
      {course.tees.length > 0 && (
        <Link href="/briefing">
          <Button variant="secondary" className="w-full">
            Create Briefing for This Course
          </Button>
        </Link>
      )}

      {showAddTee ? (
        <div className="flex flex-col gap-3 p-4 rounded-lg border border-divider bg-white">
          <SectionTitle>New Tee</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Tee Name"
              value={teeName}
              onChange={setTeeName}
              placeholder="e.g. White"
            />
            <Select
              label="Color"
              value={teeColor}
              onChange={setTeeColor}
              options={TEE_COLORS}
              placeholder="Select color"
            />
            <Input
              label="Par Total"
              type="number"
              value={parTotal}
              onChange={setParTotal}
              placeholder="e.g. 72"
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
      ) : (
        <Button variant="secondary" onClick={() => setShowAddTee(true)}>
          + Add Tee
        </Button>
      )}
    </div>
  );
}
