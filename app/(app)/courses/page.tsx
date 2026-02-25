"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { InfoBanner } from "@/components/ui/info-banner";
import { CourseSearch } from "@/components/course/course-search";
import { CourseList } from "@/components/course/course-list";
import type { Course } from "@/lib/db/types";

type CourseWithTeeCount = Course & { tee_count: number };

export default function CoursesPage() {
  const [allCourses, setAllCourses] = useState<CourseWithTeeCount[]>([]);
  const [displayed, setDisplayed] = useState<CourseWithTeeCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/courses");
        if (res.ok) {
          const data = (await res.json()) as CourseWithTeeCount[];
          setAllCourses(data);
          setDisplayed(data);
        } else {
          setError("Couldn't load courses right now.");
        }
      } catch {
        setError("Something went wrong. Give it another try.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSearchResults = useCallback((courses: Course[]) => {
    setIsSearching(true);
    const withCount = courses.map((c) => ({ ...c, tee_count: 0 }));
    setDisplayed(withCount);
  }, []);

  const handleClearSearch = useCallback(() => {
    setIsSearching(false);
    setDisplayed(allCourses);
  }, [allCourses]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-secondary text-[0.9375rem]">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-secondary text-[0.9375rem]">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-accent text-[0.9375rem] font-medium hover:underline cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[1.875rem] font-semibold text-text">Courses</h1>
        <p className="text-[0.9375rem] text-secondary mt-1">
          Courses shared by everyone who plays here.
        </p>
      </div>

      <InfoBanner>
        Courses are shared. Anyone can add a course, fill in tees, mark
        hazards, and note what they know about each hole. The more players
        contribute, the better your caddie plan gets. Tap a course to add
        what you know.
      </InfoBanner>

      <CourseSearch
        onResults={handleSearchResults}
        onClear={handleClearSearch}
      />

      <CourseList
        courses={displayed}
        onDelete={(id) => {
          setAllCourses((prev) => prev.filter((c) => c.id !== id));
          setDisplayed((prev) => prev.filter((c) => c.id !== id));
        }}
      />

      {!isSearching && (
        <Link href="/courses/new">
          <Button className="w-full">Add Course</Button>
        </Link>
      )}
    </div>
  );
}
