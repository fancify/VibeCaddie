import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth/session";
import { handleChatMessage } from "@/lib/services/chat";

/** POST /api/chat — 处理聊天消息，返回 Vibe Caddie 回复 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    const body = await request.json();
    const { message, messages } = body as {
      message?: string;
      messages?: Array<{ role: "user" | "assistant"; content: string }>;
    };

    // 兼容旧格式（单条 message）和新格式（完整 messages 历史）
    const currentMessage = message?.trim() || "";
    if (!currentMessage && (!messages || messages.length === 0)) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    const response = await handleChatMessage(userId, currentMessage, messages);
    return NextResponse.json({ response });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}
