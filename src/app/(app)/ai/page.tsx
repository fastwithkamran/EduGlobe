"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { AIMessage } from "@/types";

// ─── Quick prompt suggestions — opportunity discovery focused ─────────────────
const QUICK_PROMPTS = [
  {
    label: "🏆 Hackathons in PK",
    prompt:
      "Find me active hackathons and competitions in Pakistan right now that students can join",
  },
  {
    label: "🎓 Scholarships 2026",
    prompt:
      "List top scholarships available for Pakistani students in 2026, with deadlines and eligibility",
  },
  {
    label: "💼 Internships",
    prompt:
      "What are the best internship opportunities for CS students in Pakistan right now?",
  },
  {
    label: "🌐 Global Contests",
    prompt:
      "What global student competitions and hackathons are open to Pakistani students?",
  },
];

function timeLabel(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Render markdown-like bold + line breaks
function renderContent(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong key={i} style={{ color: "var(--text-primary)" }}>
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

const MAX_MESSAGE_LENGTH = 1_000;

export default function AIPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Hi! I'm EduGlobe's AI Assistant, powered by Gemini 🇵🇰\n\nI help Pakistani (and global) students discover **hackathons**, **scholarships**, **internships**, and **competitions** — so you never miss an opportunity again.\n\nWhat are you looking for today?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    if (trimmed.length > MAX_MESSAGE_LENGTH) return; // hard guard (UI enforces this)

    const userMsg: AIMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setTimeout(
      () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
      50,
    );

    const aiMsgId = crypto.randomUUID();

    try {
      const token = user ? await user.getIdToken() : null;

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: trimmed,
          history: messages
            .filter((m) => m.id !== "welcome")
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "API error");
      }

      // ── Streaming: create placeholder message, fill it as chunks arrive ──
      setMessages((prev) => [
        ...prev,
        {
          id: aiMsgId,
          role: "assistant" as const,
          content: "",
          timestamp: new Date(),
        },
      ]);
      setLoading(false); // hide typing indicator once streaming starts

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId ? { ...m, content: m.content + chunk } : m,
          ),
        );
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    } catch (err) {
      setLoading(false);
      const errText =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";
      setMessages((prev) => [
        ...prev,
        {
          id: aiMsgId,
          role: "assistant" as const,
          content: errText,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(
        () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
        50,
      );
    }
  };

  return (
    <div
      style={{
        padding: "var(--page-padding-y) var(--page-padding-x)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: 22,
            fontWeight: 800,
            marginBottom: 4,
          }}
        >
          🤖 AI Assistant
        </h1>
        <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>
          Powered by Google Gemini
        </p>
      </div>

      {/* Quick prompts */}
      <div
        style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}
      >
        {QUICK_PROMPTS.map((qp) => (
          <button
            key={qp.label}
            className="btn btn-outline btn-sm"
            onClick={() => sendMessage(qp.prompt)}
            disabled={loading}
            style={{ fontSize: 12 }}
          >
            {qp.label}
          </button>
        ))}
      </div>

      {/* Chat window */}
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-primary)",
          borderRadius: "var(--radius-xl)",
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* Status bar */}
        <div
          style={{
            padding: "12px 18px",
            borderBottom: "1px solid var(--border-primary)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--primary-500)",
              boxShadow: "0 0 6px var(--primary-500)",
              animation: "pulse 2s infinite",
            }}
          />
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            EduGlobe AI
          </span>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            • Gemini 2.5 Flash Lite
          </span>
        </div>

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 18,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  gap: 10,
                  flexDirection: isUser ? "row-reverse" : "row",
                  maxWidth: "85%",
                  alignSelf: isUser ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: isUser
                      ? "var(--gradient-primary)"
                      : "linear-gradient(135deg,#3b82f6,#10b981)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#fff",
                  }}
                >
                  {isUser
                    ? (user?.displayName?.slice(0, 2).toUpperCase() ?? "ME")
                    : "AI"}
                </div>
                <div>
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: isUser
                        ? "12px 4px 12px 12px"
                        : "4px 12px 12px 12px",
                      background: isUser
                        ? "var(--gradient-primary)"
                        : "var(--bg-tertiary)",
                      color: isUser ? "#fff" : "var(--text-primary)",
                      fontSize: 13,
                      lineHeight: 1.7,
                      whiteSpace: "pre-wrap",
                      border: isUser
                        ? "none"
                        : "1px solid var(--border-primary)",
                    }}
                  >
                    {renderContent(msg.content)}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--text-muted)",
                      marginTop: 3,
                      textAlign: isUser ? "right" : "left",
                    }}
                  >
                    {timeLabel(msg.timestamp)}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {loading && (
            <div style={{ display: "flex", gap: 10, maxWidth: "85%" }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg,#3b82f6,#10b981)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                AI
              </div>
              <div
                style={{
                  padding: "10px 14px",
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border-primary)",
                  borderRadius: "4px 12px 12px 12px",
                  display: "flex",
                  gap: 4,
                  alignItems: "center",
                }}
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--text-tertiary)",
                      animation: `bounce .6s ease ${i * 0.1}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--border-primary)",
          }}
        >
          {/* Char counter — only visible when approaching limit */}
          {input.length > 800 && (
            <div
              style={{
                fontSize: 10,
                textAlign: "right",
                marginBottom: 4,
                color:
                  input.length >= MAX_MESSAGE_LENGTH
                    ? "#ef4444"
                    : "var(--text-muted)",
              }}
            >
              {input.length}/{MAX_MESSAGE_LENGTH}
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <input
              ref={inputRef}
              className="input"
              style={{ flex: 1 }}
              placeholder="Ask anything…"
              value={input}
              maxLength={MAX_MESSAGE_LENGTH}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !e.shiftKey && sendMessage(input)
              }
              disabled={loading}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={() => sendMessage(input)}
              disabled={
                loading || !input.trim() || input.length > MAX_MESSAGE_LENGTH
              }
            >
              {loading ? "⏳" : "Send"}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-4px)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>
    </div>
  );
}
