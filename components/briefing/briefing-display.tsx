"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { SectionTitle } from "@/components/ui/section-title";
import { Button } from "@/components/ui/button";
import type { PreRoundBriefing, CourseTee, Course } from "@/lib/db/types";

interface BriefingDisplayProps {
  briefing: PreRoundBriefing;
}

/** 渲染洞号圆形徽章 */
function HolePill({
  hole,
  variant,
}: {
  hole: number;
  variant: "driver" | "control";
}) {
  const styles =
    variant === "driver"
      ? "bg-accent/10 text-accent border-accent/30"
      : "bg-amber-50 text-amber-700 border-amber-200";

  return (
    <span
      className={`
        inline-flex items-center justify-center
        min-w-[2rem] h-8 px-2 rounded-full
        text-[0.8125rem] font-medium border
        ${styles}
      `}
    >
      {hole}
    </span>
  );
}

/** 将 display_text 按 ## 拆分并渲染为段落 */
function BriefingText({ text }: { text: string }) {
  // 按 ## 标题拆分，保留标题文本
  const sections = text.split(/^## /m).filter(Boolean);

  return (
    <div className="flex flex-col gap-5">
      {sections.map((section, idx) => {
        const lines = section.split("\n");
        const title = lines[0]?.trim();
        const body = lines.slice(1).join("\n").trim();

        return (
          <div key={idx}>
            {title && (
              <h3 className="text-[1.0625rem] font-semibold text-text mb-2">
                {title}
              </h3>
            )}
            {body && (
              <div className="text-[0.9375rem] leading-[1.625rem] text-text/85 whitespace-pre-line">
                {body.split("\n").map((line, lineIdx) => {
                  const trimmed = line.trim();
                  // 渲染 bullet 列表行
                  if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                    return (
                      <div key={lineIdx} className="flex gap-2 ml-1">
                        <span className="text-secondary shrink-0">&#8226;</span>
                        <span>{trimmed.slice(2)}</span>
                      </div>
                    );
                  }
                  // 空行
                  if (!trimmed) {
                    return <div key={lineIdx} className="h-2" />;
                  }
                  // 普通文本行
                  return <p key={lineIdx}>{trimmed}</p>;
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function BriefingDisplay({ briefing }: BriefingDisplayProps) {
  const bj = briefing.briefing_json;

  // 加载球场和 tee 信息用于副标题
  const [courseName, setCourseName] = useState("");
  const [teeName, setTeeName] = useState("");

  useEffect(() => {
    async function loadCourseInfo() {
      try {
        // 获取 tee 信息来取得 course_id
        // 我们通过遍历球场列表来找到对应的 tee
        const coursesRes = await fetch("/api/courses");
        if (!coursesRes.ok) return;
        const courses = (await coursesRes.json()) as Course[];

        for (const course of courses) {
          const detailRes = await fetch(`/api/courses/${course.id}`);
          if (!detailRes.ok) continue;
          const detail = await detailRes.json();
          const tee = (detail.tees as CourseTee[])?.find(
            (t) => t.id === briefing.course_tee_id
          );
          if (tee) {
            setCourseName(course.name);
            setTeeName(tee.tee_name);
            break;
          }
        }
      } catch {
        // 加载失败不阻塞页面
      }
    }
    loadCourseInfo();
  }, [briefing.course_tee_id]);

  const formattedDate = new Date(briefing.play_date + "T00:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric", year: "numeric" }
  );

  return (
    <div className="flex flex-col gap-6">
      {/* 页头 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[1.875rem] font-semibold text-text">
            Vibe Caddie Briefing
          </h1>
          <p className="text-[0.9375rem] text-secondary mt-1">
            {courseName && teeName
              ? `${courseName} — ${teeName}`
              : "Loading course info..."}
            {" "}&#183; {formattedDate}
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => window.print()}
          className="shrink-0"
        >
          <svg
            className="w-4 h-4 mr-1.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
            />
          </svg>
          Print
        </Button>
      </div>

      {/* 结构化数据 */}
      <Card>
        <div className="flex flex-col gap-4">
          {/* Driver OK 洞 */}
          {bj.driver_ok_holes.length > 0 && (
            <div>
              <p className="text-[0.8125rem] font-medium text-secondary mb-2">
                Driver OK
              </p>
              <div className="flex flex-wrap gap-2">
                {bj.driver_ok_holes.map((hole) => (
                  <HolePill key={hole} hole={hole} variant="driver" />
                ))}
              </div>
            </div>
          )}

          {/* Control 洞 */}
          {bj.control_holes.length > 0 && (
            <div>
              <p className="text-[0.8125rem] font-medium text-secondary mb-2">
                Control Club
              </p>
              <div className="flex flex-wrap gap-2">
                {bj.control_holes.map((hole) => (
                  <HolePill key={hole} hole={hole} variant="control" />
                ))}
              </div>
            </div>
          )}

          {/* 避让侧 */}
          {bj.avoid_side !== "none" && (
            <div className="flex items-center gap-2 pt-1">
              <svg
                className="w-4 h-4 text-amber-600 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              <p className="text-[0.9375rem] text-text">
                Most trouble is on the{" "}
                <span className="font-semibold">{bj.avoid_side}</span> — favor
                the opposite side off the tee.
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* LLM 生成的文字内容 */}
      <Card>
        <SectionTitle className="mb-4">Caddie Notes</SectionTitle>
        <BriefingText text={bj.display_text} />
      </Card>
    </div>
  );
}
