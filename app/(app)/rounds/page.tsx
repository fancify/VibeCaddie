"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Round } from "@/lib/db/types";

type RoundWithInfo = Round & {
  course_name?: string;
  tee_name?: string;
};

export default function RoundsListPage() {
  const [rounds, setRounds] = useState<RoundWithInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/rounds");
        if (res.ok) {
          const data = (await res.json()) as RoundWithInfo[];
          setRounds(data);
        } else {
          setError("Failed to load rounds.");
        }
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[1.875rem] font-semibold text-text">
            My Rounds
          </h1>
          <p className="text-[0.9375rem] text-secondary mt-1">
            Track your rounds and performance.
          </p>
        </div>
        <Link href="/rounds/new">
          <Button>Enter New Round</Button>
        </Link>
      </div>

      {rounds.length === 0 ? (
        <Card>
          <p className="text-center text-secondary text-[0.9375rem] py-8">
            No rounds recorded yet.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {rounds.map((round) => (
            <Link key={round.id} href={`/rounds/${round.id}`}>
              <Card className="hover:shadow-md transition-shadow duration-150 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[0.9375rem] font-medium text-text">
                      {round.course_name ?? "Unknown Course"}
                    </p>
                    <p className="text-[0.8125rem] text-secondary">
                      {round.tee_name ?? ""} &middot;{" "}
                      {new Date(round.played_date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    {round.total_score !== null && (
                      <p className="text-[1.25rem] font-semibold text-text">
                        {round.total_score}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
