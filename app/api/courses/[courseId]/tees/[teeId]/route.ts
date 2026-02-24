import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth/session";
import { updateCourseTee, deleteCourseTee } from "@/lib/db/courses";

interface RouteContext {
  params: Promise<{ courseId: string; teeId: string }>;
}

/** PUT /api/courses/[courseId]/tees/[teeId] — 更新 tee */
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    await getUserId();
    const { teeId } = await context.params;
    const body = await request.json();
    const { tee_name, par_total, course_rating, slope_rating } = body as {
      tee_name?: string;
      par_total?: number;
      course_rating?: number | null;
      slope_rating?: number | null;
    };

    if (tee_name !== undefined && !tee_name.trim()) {
      return NextResponse.json(
        { error: "Tee name cannot be empty" },
        { status: 400 }
      );
    }
    if (par_total !== undefined && (par_total < 1 || !Number.isInteger(par_total))) {
      return NextResponse.json(
        { error: "Valid par total is required" },
        { status: 400 }
      );
    }

    const updated = await updateCourseTee(teeId, {
      tee_name: tee_name?.trim(),
      par_total,
      course_rating,
      slope_rating,
    });

    if (!updated) {
      return NextResponse.json({ error: "Tee not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
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

/** DELETE /api/courses/[courseId]/tees/[teeId] — 删除 tee（含洞和障碍物） */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    await getUserId();
    const { teeId } = await context.params;

    const deleted = await deleteCourseTee(teeId);
    if (!deleted) {
      return NextResponse.json({ error: "Tee not found" }, { status: 404 });
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
