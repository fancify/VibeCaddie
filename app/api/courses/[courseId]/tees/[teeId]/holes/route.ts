import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth/session";
import { getCourseHoles, upsertCourseHole, recalcTeeParTotal } from "@/lib/db/courses";

interface RouteContext {
  params: Promise<{ courseId: string; teeId: string }>;
}

/** GET /api/courses/[courseId]/tees/[teeId]/holes — 列出 tee 的所有球洞 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    await getUserId();
    const { teeId } = await context.params;
    const holes = await getCourseHoles(teeId);
    return NextResponse.json(holes);
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

/** PUT /api/courses/[courseId]/tees/[teeId]/holes — 批量 upsert 球洞 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { teeId } = await context.params;
    const body = await request.json();
    const { holes } = body as {
      holes: Array<{
        hole_number: number;
        par: number;
        yardage: number;
        si?: number;
      }>;
    };

    if (!Array.isArray(holes) || holes.length === 0) {
      return NextResponse.json(
        { error: "holes array is required" },
        { status: 400 }
      );
    }

    await getUserId();

    // 逐一 upsert（利用 ON CONFLICT）
    const results = await Promise.all(
      holes.map((h) =>
        upsertCourseHole({
          course_tee_id: teeId,
          hole_number: h.hole_number,
          par: h.par,
          yardage: h.yardage,
          si: h.si,
        })
      )
    );

    // 根据实际球洞 par 之和更新 tee 的 par_total
    await recalcTeeParTotal(teeId);

    return NextResponse.json(results);
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
