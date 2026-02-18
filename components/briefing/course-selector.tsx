"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/section-title";
import type { Course, CourseTee } from "@/lib/db/types";

/** tee 颜色对应的圆点色 */
const COLOR_MAP: Record<string, string> = {
  White: "bg-gray-200",
  Blue: "bg-blue-500",
  Red: "bg-red-500",
  Gold: "bg-yellow-400",
  Black: "bg-gray-800",
};

function todayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** 三步选择器：球场 -> Tee -> 日期 -> 生成 */
export function CourseSelector() {
  const router = useRouter();

  // 步骤 1：搜索并选择球场
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 步骤 2：选择 tee
  const [tees, setTees] = useState<CourseTee[]>([]);
  const [selectedTeeId, setSelectedTeeId] = useState<string | null>(null);
  const [loadingTees, setLoadingTees] = useState(false);

  // 步骤 3：选择日期
  const [playDate, setPlayDate] = useState(todayString());

  // 生成状态
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  // 搜索球场（防抖 300ms）
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!query.trim() || selectedCourse) {
      setSearchResults([]);
      return;
    }

    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/courses/search?q=${encodeURIComponent(query.trim())}`
        );
        if (res.ok) {
          const data = (await res.json()) as Course[];
          setSearchResults(data);
        }
      } catch {
        // 搜索失败不处理
      }
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, selectedCourse]);

  // 选中球场后加载 tee 列表
  const handleSelectCourse = useCallback(async (course: Course) => {
    setSelectedCourse(course);
    setSearchResults([]);
    setQuery(course.name);
    setSelectedTeeId(null);
    setTees([]);
    setLoadingTees(true);
    setError("");

    try {
      const res = await fetch(`/api/courses/${course.id}`);
      if (res.ok) {
        const data = await res.json();
        setTees(data.tees ?? []);
      }
    } catch {
      // 加载失败
    } finally {
      setLoadingTees(false);
    }
  }, []);

  // 清除选中的球场
  function handleClearCourse() {
    setSelectedCourse(null);
    setQuery("");
    setTees([]);
    setSelectedTeeId(null);
    setError("");
  }

  // 生成简报
  async function handleGenerate() {
    if (!selectedTeeId || !playDate) return;

    setGenerating(true);
    setError("");

    try {
      const res = await fetch("/api/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_tee_id: selectedTeeId,
          play_date: playDate,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/briefing/${data.id}`);
      } else {
        const errData = await res.json().catch(() => null);
        setError(errData?.error ?? "Failed to generate briefing.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 步骤 1：选择球场 */}
      <Card>
        <SectionTitle className="mb-3">1. Select Course</SectionTitle>

        {selectedCourse ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[0.9375rem] font-medium text-text">
                {selectedCourse.name}
              </p>
              {selectedCourse.location_text && (
                <p className="text-[0.8125rem] text-secondary">
                  {selectedCourse.location_text}
                </p>
              )}
            </div>
            <button
              onClick={handleClearCourse}
              className="text-[0.8125rem] text-accent font-medium hover:underline cursor-pointer"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <svg
                className="w-4 h-4 text-secondary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search courses..."
              className="
                w-full rounded-lg pl-10 pr-3 py-2.5
                text-[0.9375rem] leading-[1.5rem] text-text
                border border-divider bg-white
                placeholder:text-secondary
                transition-colors duration-150
                outline-none
                focus:border-accent focus:ring-1 focus:ring-accent
              "
            />

            {/* 搜索结果下拉 */}
            {searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-divider rounded-lg shadow-card overflow-hidden">
                {searchResults.map((course) => (
                  <button
                    key={course.id}
                    onClick={() => handleSelectCourse(course)}
                    className="
                      w-full text-left px-4 py-3
                      hover:bg-bg transition-colors duration-150
                      cursor-pointer
                    "
                  >
                    <p className="text-[0.9375rem] font-medium text-text">
                      {course.name}
                    </p>
                    {course.location_text && (
                      <p className="text-[0.8125rem] text-secondary">
                        {course.location_text}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 步骤 2：选择 Tee */}
      {selectedCourse && (
        <Card>
          <SectionTitle className="mb-3">2. Select Tee</SectionTitle>

          {loadingTees ? (
            <p className="text-[0.9375rem] text-secondary">Loading tees...</p>
          ) : tees.length === 0 ? (
            <p className="text-[0.9375rem] text-secondary">
              No tees found for this course. Add tees in the course editor first.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {tees.map((tee) => (
                <button
                  key={tee.id}
                  onClick={() => setSelectedTeeId(tee.id)}
                  className={`
                    flex items-center gap-3 w-full rounded-lg px-4 py-3
                    border transition-colors duration-150 cursor-pointer text-left
                    ${
                      selectedTeeId === tee.id
                        ? "border-accent bg-accent/5"
                        : "border-divider hover:bg-bg"
                    }
                  `}
                >
                  {tee.tee_color && COLOR_MAP[tee.tee_color] && (
                    <span
                      className={`w-3 h-3 rounded-full shrink-0 ${COLOR_MAP[tee.tee_color]}`}
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
                  {selectedTeeId === tee.id && (
                    <svg
                      className="w-5 h-5 text-accent ml-auto shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* 步骤 3：选择日期 */}
      {selectedTeeId && (
        <Card>
          <SectionTitle className="mb-3">3. Play Date</SectionTitle>
          <input
            type="date"
            value={playDate}
            onChange={(e) => setPlayDate(e.target.value)}
            className="
              w-full rounded-lg px-3 py-2.5
              text-[0.9375rem] leading-[1.5rem] text-text
              border border-divider bg-white
              transition-colors duration-150
              outline-none
              focus:border-accent focus:ring-1 focus:ring-accent
            "
          />
        </Card>
      )}

      {/* 生成按钮 */}
      {selectedTeeId && playDate && (
        <div className="flex flex-col gap-3">
          {error && (
            <p className="text-[0.8125rem] text-red-500 text-center">{error}</p>
          )}

          {generating ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-8 h-8 border-3 border-accent/30 border-t-accent rounded-full animate-spin" />
              <p className="text-[0.9375rem] text-secondary">
                Generating your caddie briefing...
              </p>
            </div>
          ) : (
            <Button
              onClick={handleGenerate}
              className="w-full text-[1rem] py-3"
            >
              Generate Briefing
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
