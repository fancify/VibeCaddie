"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { InfoBanner } from "@/components/ui/info-banner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HoleEditor } from "@/components/course/hole-editor";
import type { Course, CourseTee } from "@/lib/db/types";

interface CourseWithTees extends Course {
  tees: CourseTee[];
}

export default function HolesPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const courseId = params.courseId as string;
  const teeId = params.teeId as string;

  // 优先从 URL query 取名字（创建后跳转时带过来），fallback 到 API
  const [courseName, setCourseName] = useState(
    searchParams.get("course") ?? ""
  );
  const [teeName, setTeeName] = useState(searchParams.get("tee") ?? "");
  const [location, setLocation] = useState(searchParams.get("loc") ?? "");
  const [loading, setLoading] = useState(true);

  // CR / SL 状态
  const [courseRating, setCourseRating] = useState("");
  const [slopeRating, setSlopeRating] = useState("");
  const [savingRating, setSavingRating] = useState(false);
  const [ratingFeedback, setRatingFeedback] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/courses/${courseId}`);
        if (res.ok) {
          const data = (await res.json()) as CourseWithTees;
          if (!courseName) {
            setCourseName(data.name);
            setLocation(data.location_text ?? "");
          }
          const tee = data.tees.find((t) => t.id === teeId);
          if (tee) {
            if (!teeName) setTeeName(tee.tee_name);
            setCourseRating(tee.course_rating != null ? String(tee.course_rating) : "");
            setSlopeRating(tee.slope_rating != null ? String(tee.slope_rating) : "");
          }
        }
      } catch {
        // 加载失败
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [courseId, teeId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSaveRating() {
    const cr = parseFloat(courseRating);
    const sl = parseInt(slopeRating, 10);
    if (isNaN(cr) || cr <= 0 || isNaN(sl) || sl <= 0) {
      setRatingFeedback("Enter valid Course Rating and Slope Rating.");
      setTimeout(() => setRatingFeedback(""), 3000);
      return;
    }
    setSavingRating(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/tees/${teeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_rating: cr, slope_rating: sl }),
      });
      if (res.ok) {
        setRatingFeedback("Saved!");
      } else {
        setRatingFeedback("Failed to save.");
      }
    } catch {
      setRatingFeedback("Network error.");
    } finally {
      setSavingRating(false);
      setTimeout(() => setRatingFeedback(""), 3000);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-secondary text-[0.9375rem]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 返回链接 */}
      <Link
        href={`/courses/${courseId}`}
        className="text-[0.8125rem] text-accent hover:underline self-start"
      >
        &larr; Back to {courseName || "course"}
      </Link>

      {/* 标题区域 */}
      <div>
        <p className="text-[0.75rem] font-medium text-secondary uppercase tracking-wide">
          Course Setup
        </p>
        <h1 className="text-[1.875rem] font-semibold text-text leading-tight mt-1">
          {courseName || "Course"}
          {teeName && (
            <span className="text-secondary font-normal">
              {" "}&mdash; {teeName} Tee
            </span>
          )}
        </h1>
        {location && (
          <p className="text-[0.875rem] text-secondary mt-0.5">{location}</p>
        )}
      </div>

      {/* 协作提示 */}
      <InfoBanner>
        Fill in what you remember — par, yardage, stroke index, and hole
        notes. Approximate is fine. Other players can add what you missed.
      </InfoBanner>

      {/* Course Rating & Slope Rating */}
      <div className="flex flex-col gap-2 p-4 rounded-lg border border-divider bg-white">
        <p className="text-[0.8125rem] font-medium text-text">
          Course Rating &amp; Slope
        </p>
        <p className="text-[0.75rem] text-secondary -mt-1">
          Used to calculate your VibeCaddie Index after each round.
        </p>
        <div className="flex items-end gap-3">
          <div className="w-32">
            <Input
              label="Course Rating"
              type="number"
              value={courseRating}
              onChange={setCourseRating}
              placeholder="e.g. 71.5"
            />
          </div>
          <div className="w-32">
            <Input
              label="Slope Rating"
              type="number"
              value={slopeRating}
              onChange={setSlopeRating}
              placeholder="e.g. 130"
            />
          </div>
          <Button variant="secondary" onClick={handleSaveRating} disabled={savingRating}>
            {savingRating ? "Saving..." : "Save"}
          </Button>
          {ratingFeedback && (
            <span className={`text-[0.8125rem] ${ratingFeedback === "Saved!" ? "text-accent" : "text-red-500"}`}>
              {ratingFeedback}
            </span>
          )}
        </div>
      </div>

      {/* 球洞编辑器 */}
      <HoleEditor
        courseId={courseId}
        teeId={teeId}
        onFinish={() => {
          const qs = new URLSearchParams({
            done: "1",
            ...(courseName ? { course: courseName } : {}),
          });
          router.push(`/courses/${courseId}?${qs.toString()}`);
        }}
      />
    </div>
  );
}
