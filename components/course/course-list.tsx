"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import type { Course } from "@/lib/db/types";

interface CourseWithTeeCount extends Course {
  tee_count: number;
}

interface CourseListProps {
  courses: CourseWithTeeCount[];
  onDelete?: (courseId: string) => void;
}

/** 球场列表，点击跳转到球场详情 */
export function CourseList({ courses, onDelete }: CourseListProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, course: CourseWithTeeCount) => {
    e.stopPropagation();
    if (!confirm(`删除「${course.name}」及其所有 tee 和球洞数据？此操作不可撤销。`)) return;

    setDeletingId(course.id);
    try {
      const res = await fetch(`/api/courses/${course.id}`, { method: "DELETE" });
      if (res.ok) {
        onDelete?.(course.id);
      }
    } catch { /* 静默 */ }
    setDeletingId(null);
  };

  if (courses.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-secondary text-[0.9375rem]">
          No courses yet. Be the first to add one!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {courses.map((course) => (
        <Card
          key={course.id}
          className="cursor-pointer hover:shadow-md transition-shadow"
        >
          <div
            onClick={() => router.push(`/courses/${course.id}`)}
            className="flex items-center justify-between"
          >
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <span className="text-[0.9375rem] font-medium text-text">
                {course.name}
              </span>
              {course.location_text && (
                <span className="text-[0.8125rem] text-secondary">
                  {course.location_text}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 ml-4 shrink-0">
              <span className="text-[0.8125rem] text-secondary whitespace-nowrap">
                {course.tee_count} {course.tee_count === 1 ? "tee" : "tees"}
              </span>
              <button
                type="button"
                onClick={(e) => handleDelete(e, course)}
                disabled={deletingId === course.id}
                className="text-secondary hover:text-red-500 transition-colors cursor-pointer p-1"
                title="删除球场"
              >
                {deletingId === course.id ? (
                  <span className="text-[0.75rem]">...</span>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
