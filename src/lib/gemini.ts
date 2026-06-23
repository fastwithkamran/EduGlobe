// ============================================================
// EduGlobe — Gemini AI Service (Server-Side)
// Used in /api/ai route. Never import directly in client components.
// ============================================================
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.EDU_AI_KEY;

if (!apiKey) {
  console.warn('⚠️  Missing GEMINI_API_KEY — AI features unavailable.');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export const geminiModel = genAI
  ? genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })
  : null;

// ─── EduGlobe System Prompt ───────────────────────────────────────────────────
// EduGlobe is a global platform for students where they can discover and follow
// posts from institutions, organisations, and individual scholars worldwide.
// Users include university students, academic institutions, NGOs, research
// bodies, and thought leaders who share knowledge, events, and opportunities.

export const SYSTEM_PROMPT = `You are the AI Assistant for EduGlobe — a global discovery platform for students.

About EduGlobe:
EduGlobe connects students worldwide with posts, updates, and knowledge from universities, institutions, organisations, NGOs, research bodies, and individual scholars. Students follow the pages that matter to them and see a personalised global feed of academic content, events, opportunities, and insights.

You help institutions, organisations, and scholars who publish on EduGlobe with:
- Writing compelling announcement posts that engage a global student audience
- Drafting event descriptions for academic events, workshops, webinars, and competitions
- Generating social media captions for sharing EduGlobe content across platforms
- Suggesting content strategies to grow followers and increase post engagement
- Writing professional outreach emails to partner institutions or sponsors
- Crafting scholarship, internship, and opportunity announcements
- Summarising research findings in student-friendly language
- Providing tips for building a credible academic presence on EduGlobe

Tone guidelines:
- Be professional yet approachable — you are speaking to educators and students
- Be globally inclusive — avoid region-specific assumptions unless the user specifies
- Keep responses clear, well-structured, and actionable
- Use markdown formatting (bold, bullet points) where it aids readability
- When drafting posts or emails, tailor content to resonate with a diverse, international student audience`;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Generate a response from Gemini given a user message and conversation history.
 * Called from /api/ai/route.ts — NEVER from client components.
 */
export async function generateAIResponse(
  userMessage: string,
  conversationHistory: ChatMessage[] = [],
): Promise<string> {
  if (!geminiModel) {
    return 'AI Assistant is currently unavailable. Please ensure EDU_AI_KEY is configured in your environment variables.';
  }

  try {
    const chat = geminiModel.startChat({
      history: [
        { role: 'user',  parts: [{ text: SYSTEM_PROMPT }] },
        { role: 'model', parts: [{ text: 'Understood. I am EduGlobe\'s AI Assistant, ready to help institutions, organisations, and scholars create impactful content for students worldwide.' }] },
        ...conversationHistory.map(msg => ({
          role: msg.role === 'assistant' ? 'model' as const : 'user' as const,
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

    const result = await chat.sendMessage(userMessage);
    return result.response.text();
  } catch (error) {
    console.error('Gemini API error:', error);
    return 'I encountered an issue processing your request. Please try again in a moment.';
  }
}
