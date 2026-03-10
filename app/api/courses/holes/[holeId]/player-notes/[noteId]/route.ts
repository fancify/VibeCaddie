import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth/session";
import { deletePlayerNote } from "@/lib/db/courses";

interface RouteContext {
  params: Promise<{ holeId: string; noteId: string }>;
}

/** DELETE /api/courses/holes/[holeId]/player-notes/[noteId] — delete own note only */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const userId = await getUserId();
    const { noteId } = await context.params;
    const deleted = await deletePlayerNote(noteId, userId);
    if (!deleted) {
      return NextResponse.json({ error: "Not found or not yours" }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
