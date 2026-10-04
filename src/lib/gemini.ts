// ============================================================
// EduGlobe — Gemini AI Service (Server-Side)
// Used in /api/ai route. Never import directly in client components.
// ============================================================
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.EDU_AI_KEY;

if (!apiKey) {
  console.warn("⚠️  Missing EDU_AI_KEY — AI features unavailable.");
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export const geminiModel = genAI
  ? genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" })
  : null;

// ─── EduGlobe System Prompt ───────────────────────────────────────────────────
// EduGlobe is a global platform for students where they can discover and follow
// posts from institutions, organisations, and individual scholars worldwide.
// Users include university students, academic institutions, NGOs, research
// bodies, and thought leaders who share knowledge, events, and opportunities.

export const SYSTEM_PROMPT = `You are the AI Assistant for EduGlobe — an opportunity discovery platform for Pakistani students across Pakistan and worldwide.

About EduGlobe:
EduGlobe is a centralized opportunity discovery platform that connects students—especially across Pakistan and emerging markets—with real-time hackathons, tech competitions, scholarships, internships, and academic drives. Through a personalized feed, community submissions, and live updates, EduGlobe eliminates fragmented information channels so students never miss a deadline..

You are the AI Assistant for EduGlobe — the ultimate opportunity discovery hub for students in Pakistan.

Your Primary Role:
Help students discover active hackathons, internships, scholarships, competitions, and tech events through real-time web research.

Core Behavior & Search Rules:
1. For opportunity searches, prioritize verified opportunities with application periods, deadlines, or event dates from October 1, 2026 through December 31, 2026.
2. Prefer the most recently updated, reliable sources and verify that each opportunity is still open or upcoming before listing it.
3. Clearly state exact dates. Do not present expired or out-of-window opportunities as current; if no matching opportunities are available, say so rather than inventing results.
4. Prioritize opportunities available to Pakistanis and international students.
5. Keep answers concise, highly structured, and actionable. Avoid filler intro text or unnecessary disclaimers.

Output Formatting Standard:
When listing opportunities, use compact Markdown cards with these exact details:

📌 [Opportunity Name / Title](Link)
• Eligibility: [e.g., University Undergrads / Open to All / Region]
• Deadline: [Exact Date]
• Mode / Location: [Online / In-Person / City]
• Prize / Perks: [Prize Pool / Stipend / Fully Funded]
• Quick Take: [1 line summary]

Tone Guidelines:
- Energetic, encouraging, developer-friendly, and concise.
- Direct-to-the-point layout with minimal prose.`;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Shared chat config — used by both response and stream functions
function buildChat(conversationHistory: ChatMessage[]) {
  if (!geminiModel) return null;
  return geminiModel.startChat({
    history: [
      { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
      {
        role: "model",
        parts: [
          {
            text: "Understood. I am EduGlobe's AI Assistant, ready to help institutions, organisations, and scholars create impactful content for students worldwide.",
          },
        ],
      },
      ...conversationHistory.map((msg) => ({
        role: msg.role === "assistant" ? ("model" as const) : ("user" as const),
        parts: [{ text: msg.content }],
      })),
    ],
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
      maxOutputTokens: 2048,
    },
  });
}

/**
 * Stream a Gemini response chunk-by-chunk.
 * Used by /api/ai to return a ReadableStream instead of waiting for the full response.
 * Yields text chunks as they arrive — far better UX for a chat interface.
 */
export async function* generateAIStream(
  userMessage: string,
  conversationHistory: ChatMessage[] = [],
): AsyncGenerator<string> {
  const chat = buildChat(conversationHistory);
  if (!chat) {
    yield "AI Assistant is currently unavailable. Please ensure EDU_AI_KEY is configured.";
    return;
  }
  try {
    const streamResult = await chat.sendMessageStream(userMessage);
    for await (const chunk of streamResult.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  } catch (error) {
    console.error("Gemini stream error:", error);
    yield "I encountered an issue. Please try again in a moment.";
  }
}

/**
 * Non-streaming fallback — returns the full response as a string.
 * Kept for backward compat / testing. The API route now uses generateAIStream.
 */
export async function generateAIResponse(
  userMessage: string,
  conversationHistory: ChatMessage[] = [],
): Promise<string> {
  const chat = buildChat(conversationHistory);
  if (!chat) {
    return "AI Assistant is currently unavailable. Please ensure EDU_AI_KEY is configured in your environment variables.";
  }
  try {
    const result = await chat.sendMessage(userMessage);
    return result.response.text();
  } catch (error) {
    console.error("Gemini API error:", error);
    return "I encountered an issue processing your request. Please try again in a moment.";
  }
}
