import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth/session";
import { upsertOfficialNote, deleteOfficialNote } from "@/lib/db/courses";

interface RouteContext {
  params: Promise<{ courseId: string; holeNumber: string }>;
}

/** PUT /api/courses/[courseId]/official-notes/[holeNumber] — upsert official note */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    await getUserId();
    const { courseId, holeNumber } = await context.params;
    const num = parseInt(holeNumber, 10);
    if (!num || num < 1 || num > 18) {
      return NextResponse.json({ error: "Invalid hole number" }, { status: 400 });
    }
    const { note } = (await request.json()) as { note: string };
    if (typeof note !== "string") {
      return NextResponse.json({ error: "note is required" }, { status: 400 });
    }
    if (!note.trim()) {
      await deleteOfficialNote(courseId, num);
      return new NextResponse(null, { status: 204 });
    }
    const saved = await upsertOfficialNote(courseId, num, note.trim());
    return NextResponse.json(saved);
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
