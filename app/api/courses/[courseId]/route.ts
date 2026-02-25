import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth/session";
import { getCourseById, updateCourse, getCourseTees, deleteCourse } from "@/lib/db/courses";

interface RouteContext {
  params: Promise<{ courseId: string }>;
}

/** GET /api/courses/[courseId] — 球场详情 + tee 列表 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { courseId } = await context.params;

    await getUserId();
    const [course, tees] = await Promise.all([
      getCourseById(courseId),
      getCourseTees(courseId),
    ]);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    return NextResponse.json({ ...course, tees });
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

/** PUT /api/courses/[courseId] — 更新球场 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    await getUserId();
    const { courseId } = await context.params;
    const body = await request.json();
    const { name, location_text, course_note } = body as {
      name?: string;
      location_text?: string;
      course_note?: string;
    };

    const updated = await updateCourse(courseId, {
      name: name?.trim(),
      location_text: location_text?.trim(),
      course_note: course_note?.trim(),
    });

    if (!updated) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
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

/** DELETE /api/courses/[courseId] — 删除球场及其所有 tees/holes/hazards */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    await getUserId();
    const { courseId } = await context.params;

    const deleted = await deleteCourse(courseId);
    if (!deleted) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
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
