import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth/session";
import { getRoundById, upsertRoundHole, getRoundHoles, updateRoundTotalScore } from "@/lib/db/rounds";

interface RouteContext {
  params: Promise<{ roundId: string }>;
}

/** PUT /api/rounds/[roundId]/holes — 插入或更新某一洞数据 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const userId = await getUserId();
    const { roundId } = await context.params;

    const round = await getRoundById(userId, roundId);
    if (!round) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      hole_number,
      tee_club,
      tee_result,
      approach_club,
      approach_distance,
      approach_direction,
      recovery_club,
      score,
      putts,
      bunker_count,
      water_count,
      penalty_count,
    } = body as {
      hole_number: number;
      tee_club?: string;
      tee_result?: string;
      approach_club?: string;
      approach_distance?: string;
      approach_direction?: string;
      recovery_club?: string;
      score?: number;
      putts?: number;
      bunker_count?: number;
      water_count?: number;
      penalty_count?: number;
    };

    if (!hole_number) {
      return NextResponse.json(
        { error: "hole_number is required" },
        { status: 400 }
      );
    }

    const safeTeeClub = tee_club || "-";
    const validTeeResults = ["FW", "LEFT", "RIGHT", "OB"];
    const safeTeeResult = (tee_result && validTeeResults.includes(tee_result)
      ? tee_result
      : "FW") as "FW" | "LEFT" | "RIGHT" | "OB";

    const validDistances = ["GIR", "SHORT", "LONG"];
    const safeApproachDistance = (approach_distance && validDistances.includes(approach_distance)
      ? approach_distance
      : undefined) as "GIR" | "SHORT" | "LONG" | undefined;

    const validDirections = ["CENTER", "LEFT", "RIGHT"];
    const safeApproachDirection = (approach_direction && validDirections.includes(approach_direction)
      ? approach_direction
      : undefined) as "CENTER" | "LEFT" | "RIGHT" | undefined;

    const hole = await upsertRoundHole({
      round_id: roundId,
      hole_number,
      tee_club: safeTeeClub,
      tee_result: safeTeeResult,
      approach_club: approach_club || undefined,
      approach_distance: safeApproachDistance,
      approach_direction: safeApproachDirection,
      recovery_club: recovery_club || undefined,
      score,
      putts,
      bunker_count: bunker_count ?? 0,
      water_count: water_count ?? 0,
      penalty_count: penalty_count ?? 0,
    });

    // 自动重算总分
    const allHoles = await getRoundHoles(roundId);
    const holesWithScore = allHoles.filter(h => h.score !== null);
    if (holesWithScore.length > 0) {
      const totalScore = holesWithScore.reduce((sum, h) => sum + (h.score ?? 0), 0);
      await updateRoundTotalScore(userId, roundId, totalScore);
    }

    return NextResponse.json(hole);
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Upsert hole error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
