import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth/session";
import { deleteCourseImage } from "@/lib/db/courses";

interface RouteContext {
  params: Promise<{ courseId: string; imageId: string }>;
}

/** DELETE /api/courses/[courseId]/images/[imageId] */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    await getUserId();
    const { imageId } = await context.params;
    await deleteCourseImage(imageId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
