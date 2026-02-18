"use client";

import { Card } from "@/components/ui/card";
import { SectionTitle } from "@/components/ui/section-title";
import { Button } from "@/components/ui/button";

interface RecapDisplayProps {
  recapText: string;
  courseName: string;
  teeName: string;
  playedDate: string;
}

/** 将 recap text 按 ## 拆分并渲染为段落（同 briefing-display 方式） */
function RecapText({ text }: { text: string }) {
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

export function RecapDisplay({
  recapText,
  courseName,
  teeName,
  playedDate,
}: RecapDisplayProps) {
  const formattedDate = new Date(playedDate + "T00:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric", year: "numeric" }
  );

  return (
    <div className="flex flex-col gap-6">
      {/* 页头 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[1.875rem] font-semibold text-text">
            Vibe Caddie Recap
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

      {/* LLM 生成的回顾内容 */}
      <Card>
        <SectionTitle className="mb-4">Round Review</SectionTitle>
        <RecapText text={recapText} />
      </Card>
    </div>
  );
}
