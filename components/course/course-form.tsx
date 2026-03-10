"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/section-title";
import { DuplicateWarning } from "./duplicate-warning";
import type { Course, CourseTee } from "@/lib/db/types";

const TEE_OPTIONS = [
  { value: "", label: "Select tee" },
  { value: "White", label: "White Tee" },
  { value: "Blue", label: "Blue Tee" },
  { value: "Red", label: "Red Tee" },
  { value: "Gold", label: "Gold Tee" },
  { value: "Black", label: "Black Tee" },
];

interface TeeInput {
  tee_color: string;
  par_total: string;
}

interface ImagePreview {
  id: string;
  dataUrl: string;
  fileName: string;
}

function emptyTee(): TeeInput {
  return { tee_color: "", par_total: "" };
}

/** 球场创建表单：名称 + 位置 + tee 列表 + 图片 */
export function CourseForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [tees, setTees] = useState<TeeInput[]>([emptyTee()]);
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [duplicates, setDuplicates] = useState<Course[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function updateTee(idx: number, field: keyof TeeInput, value: string) {
    setTees((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t))
    );
  }

  function removeTee(idx: number) {
    if (tees.length <= 1) return;
    setTees((prev) => prev.filter((_, i) => i !== idx));
  }

  function addTee() {
    setTees((prev) => [...prev, emptyTee()]);
  }

  function handleImageFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setImages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), dataUrl, fileName: file.name },
        ]);
      };
      reader.readAsDataURL(file);
    });
  }

  function removeImage(id: string) {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }

  // 校验 tee 数据
  function validateTees(): boolean {
    for (const tee of tees) {
      if (!tee.tee_color) {
        setError("Each tee needs a color.");
        return false;
      }
      const par = parseInt(tee.par_total, 10);
      if (!par || par < 1) {
        setError("Each tee needs a valid par total.");
        return false;
      }
    }
    return true;
  }

  async function handleSubmit(force = false) {
    setError("");
    setDuplicates(null);

    if (!name.trim()) {
      setError("Course name is required.");
      return;
    }
    if (!validateTees()) return;

    setSubmitting(true);
    try {
      // 1. 创建球场
      const courseRes = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          location_text: location.trim() || undefined,
          force,
        }),
      });

      if (courseRes.status === 409) {
        const data = await courseRes.json();
        setDuplicates(data.duplicates as Course[]);
        setSubmitting(false);
        return;
      }

      if (!courseRes.ok) {
        throw new Error("Failed to create course");
      }

      const course = (await courseRes.json()) as Course;

      // 2. 上传图片（并行）
      if (images.length > 0) {
        await Promise.all(
          images.map((img) =>
            fetch(`/api/courses/${course.id}/images`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ data_url: img.dataUrl, file_name: img.fileName }),
            })
          )
        );
      }

      // 3. 创建所有 tee（color 即 name）
      const teeResponses = await Promise.all(
        tees.map((tee) =>
          fetch(`/api/courses/${course.id}/tees`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tee_name: tee.tee_color,
              tee_color: tee.tee_color,
              par_total: parseInt(tee.par_total, 10),
            }),
          })
        )
      );

      // 4. 跳转到第一个 tee 的 holes 编辑页，带上 course 信息
      const firstTeeRes = teeResponses[0];
      if (firstTeeRes && firstTeeRes.ok) {
        const firstTee = (await firstTeeRes.json()) as CourseTee;
        const qs = new URLSearchParams({
          course: name.trim(),
          tee: tees[0].tee_color,
          ...(location.trim() ? { loc: location.trim() } : {}),
        });
        router.push(
          `/courses/${course.id}/tees/${firstTee.id}/holes?${qs.toString()}`
        );
      } else {
        router.push(`/courses/${course.id}`);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 球场基本信息 */}
      <div className="flex flex-col gap-4">
        <Input
          label="Course Name"
          value={name}
          onChange={setName}
          placeholder="e.g. Mission Hills - Ozaki Course"
        />
        <Input
          label="Location (optional)"
          value={location}
          onChange={setLocation}
          placeholder="e.g. Shenzhen, China"
        />
      </div>

      {/* 图片上传 */}
      <div className="flex flex-col gap-3">
        <SectionTitle>Photos (optional)</SectionTitle>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleImageFiles(e.target.files)}
        />
        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {images.map((img) => (
              <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden border border-divider">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.dataUrl}
                  alt={img.fileName}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(img.id)}
                  className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-xs leading-none"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center gap-2 w-full rounded-lg border border-dashed border-divider py-3 text-[0.875rem] text-secondary hover:border-accent/50 hover:text-accent transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {images.length === 0 ? "Add photos" : "Add more photos"}
        </button>
      </div>

      {/* 查重警告 */}
      {duplicates && (
        <DuplicateWarning
          duplicates={duplicates}
          onForceCreate={() => handleSubmit(true)}
        />
      )}

      {/* Tee 列表 */}
      <div className="flex flex-col gap-4">
        <SectionTitle>Tees</SectionTitle>
        {tees.map((tee, idx) => (
          <div
            key={idx}
            className="flex flex-col gap-3 p-4 rounded-lg border border-divider bg-white"
          >
            <div className="flex items-center justify-between">
              <span className="text-[0.875rem] font-medium text-text">
                Tee {idx + 1}
              </span>
              {tees.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTee(idx)}
                  className="text-[0.8125rem] text-red-500 hover:underline cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Tee"
                value={tee.tee_color}
                onChange={(v) => updateTee(idx, "tee_color", v)}
                options={TEE_OPTIONS}
                placeholder="Select tee"
              />
              <Input
                label="Par Total"
                type="number"
                value={tee.par_total}
                onChange={(v) => updateTee(idx, "par_total", v)}
                placeholder="e.g. 72"
              />
            </div>
          </div>
        ))}
        <Button variant="secondary" onClick={addTee}>
          + Add Tee
        </Button>
      </div>

      {/* 错误提示 */}
      {error && (
        <p className="text-[0.8125rem] text-red-500">{error}</p>
      )}

      {/* 提交 */}
      <Button
        type="button"
        onClick={() => handleSubmit(false)}
        disabled={submitting}
      >
        {submitting ? "Creating..." : "Create Course"}
      </Button>
    </div>
  );
}
