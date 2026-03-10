import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth/session";
import { getOfficialNotesForCourse } from "@/lib/db/courses";

interface RouteContext {
  params: Promise<{ courseId: string }>;
}

/** GET /api/courses/[courseId]/official-notes — all official notes keyed by hole_number */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    await getUserId();
    const { courseId } = await context.params;
    const notes = await getOfficialNotesForCourse(courseId);
    return NextResponse.json(notes);
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
