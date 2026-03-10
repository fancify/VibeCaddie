import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth/session";
import { getCourseImages, addCourseImage } from "@/lib/db/courses";

interface RouteContext {
  params: Promise<{ courseId: string }>;
}

/** GET /api/courses/[courseId]/images */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    await getUserId();
    const { courseId } = await context.params;
    const images = await getCourseImages(courseId);
    return NextResponse.json(images);
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** POST /api/courses/[courseId]/images — upload one image as base64 data URL */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    await getUserId();
    const { courseId } = await context.params;
    const body = await request.json() as { data_url: string; file_name?: string };

    if (!body.data_url || !body.data_url.startsWith("data:image/")) {
      return NextResponse.json({ error: "Invalid image data" }, { status: 400 });
    }

    // Limit size: ~5MB base64 ≈ ~3.75MB file
    if (body.data_url.length > 7 * 1024 * 1024) {
      return NextResponse.json({ error: "Image too large (max ~5MB)" }, { status: 413 });
    }

    const image = await addCourseImage({
      course_id: courseId,
      data_url: body.data_url,
      file_name: body.file_name,
    });

    return NextResponse.json(image, { status: 201 });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
