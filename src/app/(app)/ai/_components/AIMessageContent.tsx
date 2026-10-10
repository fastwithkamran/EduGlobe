import { Fragment, memo, type ReactNode } from "react";

/**
 * Lightweight, dependency-free markdown renderer for chat bubbles.
 *
 * Fixes vs. the previous version:
 *  - No regex lookbehind (a SyntaxError in Safari < 16.4 took down the whole bundle).
 *  - Lists render markers (Tailwind preflight sets `list-style: none`).
 *  - Ordered lists keep their numbers after a nested bullet interrupts them.
 *  - snake_case_names and "2 * 3 * 4" are no longer turned into italics/bold.
 *  - Links/lists/headings use readable colours inside the user's (green) bubble.
 *  - Fenced code blocks, inline code, blockquotes and #### headings.
 *  - Bare URLs no longer swallow a closing ")" and long URLs wrap instead of overflowing.
 *  - Memoised, so streaming a long answer doesn't re-parse finished messages.
 */

// Named groups are used so there are no fragile numeric indexes.
// Order matters: earlier alternatives win at the same position.
const INLINE_SOURCE = [
  "`(?<code>[^`\\n]+)`",
  "\\[(?<mdLabel>[^\\]\\n]+)\\]\\((?<mdUrl>https?:\\/\\/[^)\\s]+)\\)",
  "\\((?<parenLabel>[^)\\n]+)\\)\\((?<parenUrl>https?:\\/\\/[^)\\s]+)\\)",
  "(?<bareUrl>https?:\\/\\/[^\\s<>\"'`]+)",
  "\\*\\*\\*(?<boldItalic>[^*\\n]+)\\*\\*\\*",
  "\\*\\*(?<boldStar>[^*\\n]+)\\*\\*",
  "__(?<boldUnder>[^_\\n]+)__",
  "\\*(?!\\s)(?<italicStar>[^*\\n]*[^*\\s])\\*",
  "_(?!\\s)(?<italicUnder>[^_\\n]*[^_\\s])_",
].join("|");

const WORD_CHAR = new RegExp("[\\p{L}\\p{N}_]", "u");
const isWordChar = (ch: string | undefined) => !!ch && WORD_CHAR.test(ch);

const count = (s: string, ch: string) => s.split(ch).length - 1;

/** Split trailing punctuation (and an unbalanced ")") off a bare URL. */
function splitUrl(url: string): [string, string] {
  let end = url.length;
  while (end > 0) {
    const ch = url[end - 1];
    if (/[.,!?;:*\]]/.test(ch)) {
      end--;
    } else if (
      ch === ")" &&
      count(url.slice(0, end), "(") < count(url.slice(0, end), ")")
    ) {
      end--;
    } else {
      break;
    }
  }
  return [url.slice(0, end), url.slice(end)];
}

function renderInline(
  text: string,
  keyPrefix: string,
  isUser: boolean,
): ReactNode[] {
  // New instance per call: renderInline recurses, and a shared /g regex keeps lastIndex state.
  const pattern = new RegExp(INLINE_SOURCE, "g");
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let n = 0;
  let match: RegExpExecArray | null;
  const nextKey = () => `${keyPrefix}-${n++}`;

  while ((match = pattern.exec(text)) !== null) {
    const g = match.groups ?? {};
    const start = match.index;
    const end = start + match[0].length;
    const before = text[start - 1];
    const after = text[end];

    // Intraword underscores (snake_case_names) are not emphasis.
    if (
      (g.italicUnder !== undefined || g.boldUnder !== undefined) &&
      (isWordChar(before) || isWordChar(after))
    ) {
      pattern.lastIndex = start + 1;
      continue;
    }
    // A lone "*" hugging another "*" is a broken bold marker, not italics.
    if (g.italicStar !== undefined && (before === "*" || after === "*")) {
      pattern.lastIndex = start + 1;
      continue;
    }

    if (start > lastIndex) {
      parts.push(
        <Fragment key={nextKey()}>{text.slice(lastIndex, start)}</Fragment>,
      );
    }

    const rawUrl = g.mdUrl ?? g.parenUrl ?? g.bareUrl;
    if (rawUrl) {
      const [href, trailing] = g.bareUrl ? splitUrl(rawUrl) : [rawUrl, ""];
      parts.push(
        <a
          key={nextKey()}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: isUser ? "#fff" : "var(--primary-400)",
            textDecoration: "underline",
            textUnderlineOffset: 2,
            fontWeight: 600,
            overflowWrap: "anywhere",
          }}
        >
          {g.mdLabel ?? g.parenLabel ?? href}
        </a>,
      );
      if (trailing) {
        parts.push(<Fragment key={nextKey()}>{trailing}</Fragment>);
      }
    } else if (g.code !== undefined) {
      parts.push(
        <code
          key={nextKey()}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.9em",
            padding: "1px 5px",
            borderRadius: 4,
            background: isUser ? "rgba(0,0,0,0.25)" : "var(--bg-tertiary)",
            overflowWrap: "anywhere",
          }}
        >
          {g.code}
        </code>,
      );
    } else if (g.boldItalic !== undefined) {
      parts.push(
        <strong key={nextKey()}>
          <em>{g.boldItalic}</em>
        </strong>,
      );
    } else if (g.boldStar !== undefined || g.boldUnder !== undefined) {
      const key = nextKey();
      parts.push(
        <strong key={key}>
          {renderInline(g.boldStar ?? g.boldUnder, key, isUser)}
        </strong>,
      );
    } else if (g.italicStar !== undefined || g.italicUnder !== undefined) {
      const key = nextKey();
      parts.push(
        <em key={key}>
          {renderInline(g.italicStar ?? g.italicUnder, key, isUser)}
        </em>,
      );
    }

    lastIndex = end;
  }

  if (lastIndex < text.length) {
    parts.push(<Fragment key={nextKey()}>{text.slice(lastIndex)}</Fragment>);
  }

  return parts;
}

const RULE_RE = /^\s*(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/;
const LIST_RE = /^(\s*)(?:([•*-])|(\d+)[.)])\s+(.+)$/;
const FENCE_RE = /^\s*```/;
const HEADING_RE = /^#{1,6}\s+(.+?)\s*#*\s*$/;
const QUOTE_RE = /^\s*>\s?(.*)$/;

const indentOf = (ws: string) => ws.replace(/\t/g, "    ").length;

function AIMessageContentImpl({
  content,
  isUser,
}: {
  content: string;
  isUser: boolean;
}) {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  const textColor = isUser ? "#fff" : "var(--text-secondary)";
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── Fenced code block (an unclosed fence is fine while streaming) ──
    if (FENCE_RE.test(line)) {
      const startIdx = i;
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !FENCE_RE.test(lines[i])) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence
      blocks.push(
        <pre
          key={`code-${startIdx}`}
          style={{
            margin: "0 0 10px",
            padding: "10px 12px",
            maxWidth: "100%",
            overflowX: "auto",
            borderRadius: 8,
            background: isUser ? "rgba(0,0,0,0.25)" : "var(--bg-tertiary)",
            color: isUser ? "#fff" : "var(--text-primary)",
            fontFamily: "var(--font-mono)",
            fontSize: 12.5,
            lineHeight: 1.5,
            whiteSpace: "pre",
          }}
        >
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // ── Horizontal rule ──
    if (RULE_RE.test(line)) {
      blocks.push(
        <hr
          key={`rule-${i}`}
          style={{
            border: 0,
            borderTop: `1px solid ${isUser ? "rgba(255,255,255,0.35)" : "var(--border-primary)"}`,
            margin: "4px 0 12px",
          }}
        />,
      );
      i += 1;
      continue;
    }

    // ── Lists ──
    const listMatch = line.match(LIST_RE);
    if (listMatch) {
      const startIdx = i;
      const isOrdered = listMatch[3] !== undefined;
      const baseIndent = indentOf(listMatch[1]);
      // Keep the author's numbering when a nested list split an ordered list in two.
      const start = isOrdered ? parseInt(listMatch[3], 10) : undefined;
      const items: { text: string; depth: number }[] = [];

      while (i < lines.length) {
        const m = lines[i].match(LIST_RE);
        if (!m || (m[3] !== undefined) !== isOrdered) break;
        const rel = Math.max(0, indentOf(m[1]) - baseIndent);
        items.push({ text: m[4], depth: Math.min(3, Math.floor(rel / 2)) });
        i += 1;
      }

      const listStyle = {
        margin: `0 0 8px ${Math.min(3, Math.floor(baseIndent / 2)) * 16}px`,
        paddingLeft: 22,
        listStyleType: isOrdered ? "decimal" : "disc",
        listStylePosition: "outside" as const,
        color: textColor,
        lineHeight: 1.7,
      };
      const lis = items.map((item, index) => (
        <li
          key={`${startIdx}-${index}`}
          style={{ paddingLeft: 2, marginLeft: item.depth * 16 }}
        >
          {renderInline(item.text, `list-${startIdx}-${index}`, isUser)}
        </li>
      ));

      blocks.push(
        isOrdered ? (
          <ol key={`list-${startIdx}`} start={start} style={listStyle}>
            {lis}
          </ol>
        ) : (
          <ul key={`list-${startIdx}`} style={listStyle}>
            {lis}
          </ul>
        ),
      );
      continue;
    }

    // ── Blockquote ──
    const quoteMatch = line.match(QUOTE_RE);
    if (quoteMatch) {
      const startIdx = i;
      const quoted: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(QUOTE_RE);
        if (!m) break;
        quoted.push(m[1]);
        i += 1;
      }
      blocks.push(
        <blockquote
          key={`quote-${startIdx}`}
          style={{
            margin: "0 0 8px",
            padding: "2px 0 2px 12px",
            borderLeft: `3px solid ${isUser ? "rgba(255,255,255,0.5)" : "var(--border-primary)"}`,
            color: textColor,
            lineHeight: 1.7,
            overflowWrap: "anywhere",
          }}
        >
          {renderInline(quoted.join(" ").trim(), `quote-${startIdx}`, isUser)}
        </blockquote>,
      );
      continue;
    }

    // ── Heading / paragraph ──
    if (line.trim()) {
      const heading = line.match(HEADING_RE);
      const body = renderInline(heading?.[1] ?? line, `line-${i}`, isUser);
      blocks.push(
        heading ? (
          <div
            key={`line-${i}`}
            role="heading"
            aria-level={3}
            style={{
              margin: "0 0 8px",
              fontSize: 14,
              fontWeight: 700,
              lineHeight: 1.5,
              color: isUser ? "#fff" : "var(--text-primary)",
              overflowWrap: "anywhere",
            }}
          >
            {body}
          </div>
        ) : (
          <p
            key={`line-${i}`}
            style={{
              margin: "0 0 8px",
              color: isUser ? "#fff" : undefined,
              overflowWrap: "anywhere",
            }}
          >
            {body}
          </p>
        ),
      );
    }
    i += 1;
  }

  return <Fragment>{blocks}</Fragment>;
}

export const AIMessageContent = memo(AIMessageContentImpl);
