import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth/session";
import { generateRecap } from "@/lib/services/recap";
import { calculateAndSaveVibecaddieIndex } from "@/lib/services/handicap";

/** POST /api/recap — 生成赛后回顾 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    const body = await request.json();
    const { round_id } = body as { round_id: string };

    if (!round_id) {
      return NextResponse.json(
        { error: "round_id is required" },
        { status: 400 }
      );
    }

    const recapText = await generateRecap(userId, round_id);

    // 异步更新 VibeCaddie Index（不阻塞响应）
    calculateAndSaveVibecaddieIndex(userId).catch((err) =>
      console.error("VibeCaddie Index calculation error:", err)
    );

    return NextResponse.json({ recap_text: recapText }, { status: 200 });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as Error).message === "Round not found") {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }
    console.error("Recap generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate recap" },
      { status: 500 }
    );
  }
}
