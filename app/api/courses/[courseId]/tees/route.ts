import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth/session";
import { getCourseTees, createCourseTee } from "@/lib/db/courses";

interface RouteContext {
  params: Promise<{ courseId: string }>;
}

/** GET /api/courses/[courseId]/tees — 列出球场的所有 tee */
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    await getUserId();
    const { courseId } = await context.params;
    const tees = await getCourseTees(courseId);
    return NextResponse.json(tees);
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

/** POST /api/courses/[courseId]/tees — 创建 tee */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { courseId } = await context.params;
    const body = await request.json();
    const { tee_name, tee_color, par_total, course_rating, slope_rating } = body as {
      tee_name: string;
      tee_color?: string;
      par_total: number;
      course_rating?: number;
      slope_rating?: number;
    };

    if (!tee_name || !tee_name.trim()) {
      return NextResponse.json(
        { error: "Tee name is required" },
        { status: 400 }
      );
    }
    if (!par_total || par_total < 1) {
      return NextResponse.json(
        { error: "Valid par total is required" },
        { status: 400 }
      );
    }

    await getUserId();

    const tee = await createCourseTee({
      course_id: courseId,
      tee_name: tee_name.trim(),
      tee_color: tee_color?.trim() || undefined,
      par_total,
      course_rating: course_rating ?? undefined,
      slope_rating: slope_rating ?? undefined,
    });
    return NextResponse.json(tee, { status: 201 });
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
