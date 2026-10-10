"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { sanitizeImageUrl } from "@/lib/utils";
import type { AIMessage } from "@/types";
import { AIMessageContent } from "./_components/AIMessageContent";
import { FiAward, FiBriefcase, FiGlobe, FiSend, FiLoader } from "react-icons/fi";
import { HiOutlineAcademicCap, HiOutlineSparkles } from "react-icons/hi2";

// ─── Quick prompt suggestions — opportunity discovery focused ─────────────────
const QUICK_PROMPTS: Array<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  prompt: string;
}> = [
  {
    icon: FiAward,
    label: "Hackathons in PK",
    prompt:
      "Find me active hackathons and competitions in Pakistan right now that students can join",
  },
  {
    icon: HiOutlineAcademicCap,
    label: "Scholarships 2026",
    prompt:
      "List top scholarships available for Pakistani students in 2026, with deadlines and eligibility",
  },
  {
    icon: FiBriefcase,
    label: "Internships",
    prompt:
      "What are the best internship opportunities for CS students in Pakistan right now?",
  },
  {
    icon: FiGlobe,
    label: "Global Contests",
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

const MAX_MESSAGE_LENGTH = 1_000;
const CHAT_SESSION_KEY = "opportune-ai-chat-v1";

const ERROR_MARKERS = [
  "I couldn't retrieve a response right now",
  "Please try again shortly",
  "[Response interrupted",
  "[The response was interrupted",
  "Daily AI request limit reached",
  "The AI assistant is unavailable",
  "temporarily receiving high traffic",
];

function isCleanHistoryMessage(m: AIMessage): boolean {
  if (m.id === "welcome") return false;
  if (!m.content || !m.content.trim()) return false;
  return !ERROR_MARKERS.some((marker) => m.content.includes(marker));
}

type StoredAIMessage = Omit<AIMessage, "timestamp"> & { timestamp: string };

function isStoredMessage(value: unknown): value is StoredAIMessage {
  if (typeof value !== "object" || value === null) return false;

  const message = value as Partial<AIMessage>;
  return (
    typeof message.id === "string" &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    typeof message.timestamp === "string"
  );
}

export default function AIPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Hi! I'm Opportune's AI Assistant, powered by Gemini 🇵🇰\n\nI help Pakistani (and global) students discover **hackathons**, **scholarships**, **internships**, and **competitions** — so you never miss an opportunity again.\n\nWhat are you looking for today?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [requestActive, setRequestActive] = useState(false);
  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [sessionRestored, setSessionRestored] = useState(false);
  const storageErrorReported = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let restoredMessages: AIMessage[] | undefined;
    let restoreError: unknown;

    try {
      const stored = sessionStorage.getItem(CHAT_SESSION_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const validMessages = parsed
            .filter(isStoredMessage)
            .map((message) => ({
              ...message,
              timestamp: new Date(message.timestamp),
            }))
            .filter((message) => !Number.isNaN(message.timestamp.getTime()));

          if (validMessages.length > 0) {
            restoredMessages = validMessages;
          } else {
            console.warn(
              "[AIPage] Saved conversation was invalid; starting a new conversation.",
            );
          }
        } else {
          console.warn(
            "[AIPage] Saved conversation had an invalid format; starting a new conversation.",
          );
        }
      }
    } catch (error) {
      restoreError = error;
    }

    const restoreTimer = window.setTimeout(() => {
      if (restoredMessages) setMessages(restoredMessages);
      if (restoreError) {
        console.error("[AIPage] Failed to restore conversation:", restoreError);
        setAnnouncement("The previous conversation could not be restored.");
      }
      setSessionRestored(true);
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, []);

  useEffect(() => {
    if (!sessionRestored) return;

    try {
      sessionStorage.setItem(CHAT_SESSION_KEY, JSON.stringify(messages));
      storageErrorReported.current = false;
    } catch (error) {
      if (!storageErrorReported.current) {
        console.error("[AIPage] Failed to save conversation:", error);
        setAnnouncement("The conversation could not be saved.");
        storageErrorReported.current = true;
      }
    }
  }, [messages, sessionRestored]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || requestActive || !sessionRestored) return;

    if (trimmed.length > MAX_MESSAGE_LENGTH) return; // hard guard (UI enforces this)

    const userMsg: AIMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setRequestActive(true);
    setWaitingForResponse(true);
    setAnnouncement("Waiting for Opportune AI response.");
    setTimeout(
      () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
      50,
    );

    const aiMsgId = crypto.randomUUID();
    let streamingStarted = false;

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: messages
            .filter(isCleanHistoryMessage)
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
      streamingStarted = true;
      setWaitingForResponse(false);
      setAnnouncement("Opportune AI is responding.");

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

      const trailingText = decoder.decode();
      if (trailingText) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId ? { ...m, content: m.content + trailingText } : m,
          ),
        );
      }
      setAnnouncement("Opportune AI response complete.");
    } catch (err) {
      const errText =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";
      if (streamingStarted) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  content: `${m.content}\n\n[Response interrupted: ${errText}]`,
                }
              : m,
          ),
        );
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: aiMsgId,
            role: "assistant" as const,
            content: errText,
            timestamp: new Date(),
          },
        ]);
      }
      setAnnouncement(`Opportune AI response failed: ${errText}`);
    } finally {
      setRequestActive(false);
      setWaitingForResponse(false);
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
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </div>
      <div style={{ marginBottom: 16 }}>
        <h1
          className="flex items-center gap-2"
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: 22,
            fontWeight: 800,
            marginBottom: 4,
          }}
        >
          <HiOutlineSparkles className="text-[var(--primary-400)]" /> AI Assistant
        </h1>
        <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>
          Powered by Google Gemini
        </p>
      </div>

      {/* Quick prompts */}
      <div
        style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}
      >
        {QUICK_PROMPTS.map((qp) => {
          const Icon = qp.icon;
          return (
            <button
              key={qp.label}
              type="button"
              className="btn btn-outline btn-sm inline-flex items-center gap-1.5"
              onClick={() => sendMessage(qp.prompt)}
              disabled={requestActive || !sessionRestored}
              style={{ fontSize: 12 }}
            >
              <Icon className="text-sm text-[var(--primary-400)]" />
              {qp.label}
            </button>
          );
        })}
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
            Opportune AI
          </span>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            • Gemini 3.1 Flash Lite
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
                    overflow: "hidden",
                  }}
                >
                  {isUser ? (
                    user?.photoURL ? (
                      <Image
                        src={sanitizeImageUrl(user.photoURL)}
                        alt=""
                        width={28}
                        height={28}
                        style={{ objectFit: "cover", width: "100%", height: "100%" }}
                      />
                    ) : (
                      (user?.displayName?.slice(0, 2).toUpperCase() ?? "ME")
                    )
                  ) : (
                    "AI"
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
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
                      overflowWrap: "anywhere",
                      border: isUser
                        ? "none"
                        : "1px solid var(--border-primary)",
                    }}
                  >
                    <AIMessageContent content={msg.content} isUser={isUser} />
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
          {waitingForResponse && (
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
              className="input"
              style={{ flex: 1 }}
              placeholder="Ask anything…"
              aria-label="Ask Opportune AI a question"
              value={input}
              maxLength={MAX_MESSAGE_LENGTH}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !e.shiftKey && sendMessage(input)
              }
              disabled={requestActive || !sessionRestored}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm inline-flex items-center gap-1.5"
              onClick={() => sendMessage(input)}
              disabled={
                requestActive ||
                !sessionRestored ||
                !input.trim() ||
                input.length > MAX_MESSAGE_LENGTH
              }
            >
              {requestActive ? (
                <>
                  <FiLoader className="animate-spin text-sm" /> Sending…
                </>
              ) : (
                <>
                  <FiSend className="text-sm" /> Send
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-4px)} }
      `}</style>
    </div>
  );
}
