"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { PlayerProfile } from "@/lib/db/types";

interface ProfileFormProps {
  initial: PlayerProfile | null;
  onSaved: (profile: PlayerProfile) => void;
}

const SEX_OPTIONS = [
  { value: "", label: "-- Optional --" },
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
  { value: "Other", label: "Other" },
];

export function ProfileForm({ initial, onSaved }: ProfileFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [sex, setSex] = useState(initial?.sex ?? "");
  const [age, setAge] = useState(initial?.age?.toString() ?? "");
  const [handicap, setHandicap] = useState(
    initial?.handicap_index?.toString() ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setFeedback("");
    try {
      const body: Record<string, unknown> = { name: name.trim() };
      if (sex) body.sex = sex;
      if (age) body.age = Number(age);
      if (handicap) body.handicap_index = Number(handicap);

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Failed to save");
      const profile = (await res.json()) as PlayerProfile;
      onSaved(profile);
      setFeedback("Saved!");
      setTimeout(() => setFeedback(""), 2000);
    } catch {
      setFeedback("Error saving profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Name"
        value={name}
        onChange={setName}
        placeholder="Your name"
      />
      <Select
        label="Sex"
        value={sex}
        onChange={setSex}
        options={SEX_OPTIONS}
      />
      <Input
        label="Age"
        value={age}
        onChange={setAge}
        type="number"
        placeholder="Optional"
      />
      <Input
        label="Official Handicap Index"
        value={handicap}
        onChange={setHandicap}
        type="number"
        placeholder="e.g. 15.2"
      />
      {initial && (
        initial.vibecaddie_index != null ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-[0.8125rem] text-secondary font-medium">VibeCaddie Index</span>
            <span className="text-[1rem] font-semibold text-accent">
              {Number(initial.vibecaddie_index).toFixed(1)}
            </span>
            <span className="text-[0.75rem] text-secondary">
              Auto-calculated from your scored rounds
            </span>
          </div>
        ) : (
          <p className="text-[0.75rem] text-secondary">
            Add course rating &amp; slope rating to your courses to enable VibeCaddie Index calculation.
          </p>
        )
      )}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? "Saving..." : "Save Profile"}
        </Button>
        {feedback && (
          <span
            className={`text-[0.875rem] ${
              feedback === "Saved!" ? "text-accent" : "text-red-500"
            }`}
          >
            {feedback}
          </span>
        )}
      </div>
    </div>
  );
}
