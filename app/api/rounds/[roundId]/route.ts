import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth/session";
import { getRoundById, getRoundHoles, updateRoundTotalScore, saveRecapText, deleteRound } from "@/lib/db/rounds";
import { getCourseHoles } from "@/lib/db/courses";
import { query } from "@/lib/db/client";

interface RouteContext {
  params: Promise<{ roundId: string }>;
}

/** GET /api/rounds/[roundId] — 获取轮次详情（含洞数据和球场信息） */
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const userId = await getUserId();
    const { roundId } = await context.params;

    const round = await getRoundById(userId, roundId);
    if (!round) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    // 获取轮次洞数据
    const holes = await getRoundHoles(roundId);

    // 获取球场和 tee 信息
    const courseInfoResult = await query<{
      course_name: string;
      tee_name: string;
      tee_color: string | null;
      par_total: number;
      course_id: string;
    }>(
      `SELECT c.name AS course_name, ct.tee_name, ct.tee_color, ct.par_total, c.id AS course_id
       FROM course_tees ct
       JOIN courses c ON ct.course_id = c.id
       WHERE ct.id = $1`,
      [round.course_tee_id]
    );
    const courseInfo = courseInfoResult.rows[0] ?? null;

    // 获取球洞配置（par、码数等）
    const courseHoles = await getCourseHoles(round.course_tee_id);

    return NextResponse.json({
      ...round,
      holes,
      course_name: courseInfo?.course_name ?? null,
      tee_name: courseInfo?.tee_name ?? null,
      tee_color: courseInfo?.tee_color ?? null,
      par_total: courseInfo?.par_total ?? null,
      course_holes: courseHoles,
    });
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

/** PUT /api/rounds/[roundId] — 更新总杆数或 recap_text */
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const userId = await getUserId();
    const { roundId } = await context.params;
    const body = await request.json();
    const { total_score, recap_text } = body as {
      total_score?: number;
      recap_text?: string;
    };

    if (typeof total_score === "number") {
      await updateRoundTotalScore(userId, roundId, total_score);
    }

    if (typeof recap_text === "string") {
      await saveRecapText(userId, roundId, recap_text);
    }

    if (total_score === undefined && recap_text === undefined) {
      return NextResponse.json(
        { error: "total_score or recap_text is required" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
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

/** DELETE /api/rounds/[roundId] — 删除轮次 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const userId = await getUserId();
    const { roundId } = await context.params;

    const deleted = await deleteRound(userId, roundId);
    if (!deleted) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
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
