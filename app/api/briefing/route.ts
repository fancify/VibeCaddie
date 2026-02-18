import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth/session";
import { getPlayerBriefings } from "@/lib/db/briefings";
import { generateBriefing } from "@/lib/services/briefing";

/** GET /api/briefing — 获取球员所有简报列表 */
export async function GET() {
  try {
    const userId = await getUserId();
    const briefings = await getPlayerBriefings(userId);
    return NextResponse.json(briefings);
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/** POST /api/briefing — 生成新简报 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    const body = await request.json();
    const { course_tee_id, play_date } = body as {
      course_tee_id: string;
      play_date: string;
    };

    if (!course_tee_id || !play_date) {
      return NextResponse.json(
        { error: "course_tee_id and play_date are required" },
        { status: 400 }
      );
    }

    const result = await generateBriefing(userId, course_tee_id, play_date);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Briefing generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate briefing" },
      { status: 500 }
    );
  }
}
