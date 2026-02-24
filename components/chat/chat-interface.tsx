"use client";

import { useRef, useState, useEffect } from "react";
import { MessageBubble } from "./message-bubble";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Hey! I'm your Vibe Caddie. Ask me anything about your game, course strategy, or what club to hit. I'm here to help!",
  timestamp: new Date(),
};

/** 聊天主界面 — 消息列表 + 底部输入栏 */
export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 新消息时自动滚到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    // 添加用户消息
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          messages: messages
            .filter((m) => m.id !== "welcome")
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        throw new Error("Request failed");
      }

      const data = (await res.json()) as { response: string };

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content:
          "Sorry, I couldn't process that right now. Please try again in a moment.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      // 发送后重新聚焦输入框
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto px-1 py-4">
        <div className="flex flex-col gap-3">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
          ))}

          {/* 加载动画 */}
          {loading && (
            <div className="flex justify-start">
              <div className="flex flex-col gap-0.5 max-w-[85%]">
                <span className="text-[0.75rem] text-secondary ml-1">
                  Vibe Caddie
                </span>
                <div className="rounded-2xl p-3 px-4 bg-card border border-divider">
                  <TypingIndicator />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 输入区域 */}
      <div className="sticky bottom-0 bg-bg border-t border-divider p-4">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your caddie..."
            disabled={loading}
            className="
              flex-1 rounded-lg px-3 py-2.5
              text-[0.9375rem] leading-[1.5rem] text-text
              border border-divider bg-white
              placeholder:text-secondary
              transition-colors duration-150
              outline-none
              focus:border-accent focus:ring-1 focus:ring-accent
              disabled:opacity-50
            "
          />
          <button
            onClick={handleSend}
            disabled={loading || input.trim().length === 0}
            className="
              inline-flex items-center justify-center
              min-h-[44px] min-w-[44px] rounded-lg
              bg-accent text-white
              hover:bg-accent-hover active:bg-accent-hover
              transition-colors duration-150
              disabled:opacity-50 disabled:pointer-events-none
              cursor-pointer
            "
            aria-label="Send message"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

/** 发送按钮图标 */
function SendIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

/** 三点打字动画 */
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 h-[1.5rem]">
      <span className="w-2 h-2 rounded-full bg-secondary animate-bounce [animation-delay:0ms]" />
      <span className="w-2 h-2 rounded-full bg-secondary animate-bounce [animation-delay:150ms]" />
      <span className="w-2 h-2 rounded-full bg-secondary animate-bounce [animation-delay:300ms]" />
    </div>
  );
}
