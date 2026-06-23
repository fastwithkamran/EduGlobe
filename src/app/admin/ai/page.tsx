'use client';

import { useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { AIMessage } from '@/types';

// ─── Quick prompt suggestions — EduGlobe context ─────────────────────────────

const QUICK_PROMPTS = [
  { label: '📢 Announce Post',   prompt: 'Help me write an engaging announcement post to share with students globally on EduGlobe' },
  { label: '💡 Event Ideas',     prompt: 'Give me 5 creative academic event ideas for our institution that would interest students worldwide' },
  { label: '📱 Social Caption',  prompt: 'Write 3 compelling captions for sharing our institution\'s latest achievement on EduGlobe' },
  { label: '📈 Engagement Tips', prompt: 'How can our institution grow its following and increase post engagement on EduGlobe?' },
];

function timeLabel(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// Render markdown-like bold + line breaks
function renderContent(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={i} style={{ color: 'var(--text-primary)' }}>{p.slice(2, -2)}</strong>;
    }
    return <span key={i}>{p}</span>;
  });
}

export default function AIPage() {
  const { userProfile } = useAuth();
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hi! I'm EduGlobe's AI Assistant, powered by Gemini.\n\nI can help you draft **announcement posts**, generate **event ideas**, write **social media captions**, and much more.\n\nWhat would you like help with today?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: AIMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    try {
      // Call our Next.js API route which invokes Gemini server-side
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: messages
            .filter(m => m.id !== 'welcome')
            .map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) throw new Error('API error');
      const data = await res.json() as { response: string };

      const aiMsg: AIMessage = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again in a moment.',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  };

  return (
    <div style={{ padding: 'var(--page-padding-y) var(--page-padding-x)', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🤖 AI Assistant</h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Powered by Google Gemini</p>
      </div>

      {/* Quick prompts */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {QUICK_PROMPTS.map(qp => (
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
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-xl)', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Status bar */}
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary-500)', boxShadow: '0 0 6px var(--primary-500)', animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>EduGlobe AI</span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>• Gemini 2.5 Flash Lite</span>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {messages.map(msg => {
            const isUser = msg.role === 'user';
            return (
              <div key={msg.id} style={{ display: 'flex', gap: 10, flexDirection: isUser ? 'row-reverse' : 'row', maxWidth: '85%', alignSelf: isUser ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: isUser ? 'var(--gradient-primary)' : 'linear-gradient(135deg,#3b82f6,#10b981)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff',
                }}>
                  {isUser ? (userProfile?.displayName?.slice(0, 2).toUpperCase() ?? 'ME') : 'AI'}
                </div>
                <div>
                  <div style={{
                    padding: '10px 14px', borderRadius: isUser ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                    background: isUser ? 'var(--gradient-primary)' : 'var(--bg-tertiary)',
                    color: isUser ? '#fff' : 'var(--text-primary)',
                    fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap',
                    border: isUser ? 'none' : '1px solid var(--border-primary)',
                  }}>
                    {renderContent(msg.content)}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, textAlign: isUser ? 'right' : 'left' }}>
                    {timeLabel(msg.timestamp)}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {loading && (
            <div style={{ display: 'flex', gap: 10, maxWidth: '85%' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>AI</div>
              <div style={{ padding: '10px 14px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: '4px 12px 12px 12px', display: 'flex', gap: 4, alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-tertiary)', animation: `bounce .6s ease ${i * 0.1}s infinite` }} />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-primary)', display: 'flex', gap: 10 }}>
          <input
            ref={inputRef}
            className="input"
            style={{ flex: 1 }}
            placeholder="Ask anything…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            disabled={loading}
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
          >
            {loading ? '⏳' : 'Send'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-4px)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>
    </div>
  );
}
