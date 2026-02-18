"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BriefingDisplay } from "@/components/briefing/briefing-display";
import type { PreRoundBriefing } from "@/lib/db/types";

export default function BriefingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const briefingId = params.briefingId as string;

  const [briefing, setBriefing] = useState<PreRoundBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/briefing/${briefingId}`);
        if (res.ok) {
          const data = (await res.json()) as PreRoundBriefing;
          setBriefing(data);
        } else if (res.status === 404) {
          setError("Briefing not found.");
        } else {
          setError("Failed to load briefing.");
        }
      } catch {
        setError("Something went wrong.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [briefingId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-secondary text-[0.9375rem]">Loading...</p>
      </div>
    );
  }

  if (error || !briefing) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-secondary text-[0.9375rem]">
          {error || "Briefing not found."}
        </p>
        <button
          onClick={() => router.push("/briefing")}
          className="text-accent text-[0.9375rem] font-medium hover:underline cursor-pointer"
        >
          Create a new briefing
        </button>
      </div>
    );
  }

  return <BriefingDisplay briefing={briefing} />;
}
