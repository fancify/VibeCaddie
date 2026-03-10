import { NextRequest, NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth/session";
import { getPlayerNotes, upsertPlayerNote } from "@/lib/db/courses";

interface RouteContext {
  params: Promise<{ holeId: string }>;
}

/** GET /api/courses/holes/[holeId]/player-notes */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await getRequiredSession();
    const { holeId } = await context.params;
    const notes = await getPlayerNotes(holeId, session.user.id);
    return NextResponse.json(notes);
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** POST /api/courses/holes/[holeId]/player-notes — upsert own note */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await getRequiredSession();
    const { holeId } = await context.params;
    const { note } = (await request.json()) as { note: string };
    if (!note?.trim()) {
      return NextResponse.json({ error: "note is required" }, { status: 400 });
    }
    const saved = await upsertPlayerNote({
      courseHoleId: holeId,
      userId: session.user.id,
      userName: session.user.name ?? "",
      note: note.trim(),
    });
    return NextResponse.json({ ...saved, is_mine: true }, { status: 201 });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
