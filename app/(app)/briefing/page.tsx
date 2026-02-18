"use client";

import { CourseSelector } from "@/components/briefing/course-selector";

export default function NewBriefingPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[1.875rem] font-semibold text-text">
          New Briefing
        </h1>
        <p className="text-[0.9375rem] text-secondary mt-1">
          Select a course and tee to get your caddie briefing.
        </p>
      </div>

      <CourseSelector />
    </div>
  );
}
