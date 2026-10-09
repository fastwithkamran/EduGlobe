import { Fragment } from "react";

function renderInline(text: string, keyPrefix: string) {
  const pattern =
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\(([^)\n]+)\)\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s<>"']+)|\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|__([^_]+)__|(?<!\*)\*([^*\n]+)\*(?!\*)|(?<!_)_([^_\n]+)_(?!_)/g;
  const parts = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let partIndex = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={`${keyPrefix}-${partIndex++}`}>
          {text.slice(lastIndex, match.index)}
        </span>,
      );
    }

    const markdownLabel = match[1] ?? match[3];
    const link = match[2] ?? match[4] ?? match[5];
    if (link) {
      const trailing = match[5]?.match(/[.,!?;:]+$/)?.[0] ?? "";
      const href = trailing ? link.slice(0, -trailing.length) : link;
      parts.push(
        <a
          key={`${keyPrefix}-${partIndex++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "var(--primary-400)",
            textDecoration: "underline",
            textUnderlineOffset: 2,
            fontWeight: 600,
          }}
        >
          {markdownLabel ?? href}
        </a>,
      );
      if (trailing) {
        parts.push(<span key={`${keyPrefix}-${partIndex++}`}>{trailing}</span>);
      }
    } else if (match[6]) {
      parts.push(
        <strong key={`${keyPrefix}-${partIndex++}`}>
          <em>{match[6]}</em>
        </strong>,
      );
    } else if (match[7] || match[8]) {
      parts.push(
        <strong key={`${keyPrefix}-${partIndex++}`}>
          {match[7] ?? match[8]}
        </strong>,
      );
    } else if (match[9] || match[10]) {
      parts.push(
        <em key={`${keyPrefix}-${partIndex++}`}>{match[9] ?? match[10]}</em>,
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(
      <span key={`${keyPrefix}-${partIndex++}`}>{text.slice(lastIndex)}</span>,
    );
  }

  return parts;
}

export function AIMessageContent({
  content,
  isUser,
}: {
  content: string;
  isUser: boolean;
}) {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex];
    if (/^\s*(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/.test(line)) {
      blocks.push(
        <hr
          key={`rule-${lineIndex}`}
          style={{
            border: 0,
            borderTop: "1px solid var(--border-primary)",
            margin: "4px 0 12px",
          }}
        />,
      );
      lineIndex += 1;
      continue;
    }

    const listMatch = line.match(/^\s*(?:([•*-])|(\d+[.)]))  *(.+)$/);

    if (listMatch) {
      const isOrdered = Boolean(listMatch[2]);
      const items = [];
      while (lineIndex < lines.length) {
        const itemMatch = lines[lineIndex].match(
          /^\s*(?:([•*-])|(\d+[.)]))  *(.+)$/,
        );
        if (!itemMatch || Boolean(itemMatch[2]) !== isOrdered) break;
        items.push(itemMatch[3]);
        lineIndex += 1;
      }

      const List = isOrdered ? "ol" : "ul";
      blocks.push(
        <List
          key={`list-${lineIndex}`}
          style={{ margin: "0 0 8px 18px", padding: 0 }}
        >
          {items.map((item, index) => (
            <li key={`${item.slice(0, 20)}-${index}`} style={{ paddingLeft: 2 }}>
              {renderInline(item, `list-${lineIndex}-${index}`)}
            </li>
          ))}
        </List>,
      );
      continue;
    }

    if (line.trim()) {
      const heading = line.match(/^#{1,3}\s+(.+)$/);
      blocks.push(
        <p
          key={`line-${lineIndex}`}
          style={{
            margin: "0 0 8px",
            fontSize: heading ? 14 : undefined,
            fontWeight: heading ? 700 : undefined,
            color: isUser ? "#fff" : undefined,
          }}
        >
          {renderInline(heading?.[1] ?? line, `line-${lineIndex}`)}
        </p>,
      );
    }
    lineIndex += 1;
  }

  return <Fragment>{blocks}</Fragment>;
}
