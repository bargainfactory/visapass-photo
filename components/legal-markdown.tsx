import * as React from 'react';

/**
 * Tiny block-level markdown renderer for the legal pages.
 *
 * The legal copy lives in the i18n catalogs as one big multi-line string
 * per policy per locale. We need just enough markdown to express:
 *
 *   ##  heading-2
 *   blank line                  → paragraph break
 *   -   list item               → <ul><li>
 *   **bold**                    → <strong>
 *   *emphasis*                  → <em>
 *
 * Inline links are not used in the body — every cross-policy reference
 * lives in the side-nav, and inline-link translation is brittle.
 *
 * Adding a markdown library just for this would balloon the bundle for
 * three rarely-visited pages, so this self-contained renderer is the
 * right trade-off. The output relies on Tailwind's `prose` typography
 * plugin for spacing + hierarchy.
 */
export function LegalMarkdown({ source }: { source: string }) {
  // Normalise newlines and split on blank lines → blocks.
  const blocks = source.replace(/\r\n/g, '\n').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <>
      {blocks.map((block, i) => {
        // Heading-2: "## Title"
        if (block.startsWith('## ')) {
          return <h2 key={i}>{renderInline(block.slice(3))}</h2>;
        }
        // Heading-3: "### Sub-title"
        if (block.startsWith('### ')) {
          return <h3 key={i}>{renderInline(block.slice(4))}</h3>;
        }
        // Unordered list: every line begins with "- "
        if (block.split('\n').every((line) => line.startsWith('- '))) {
          const items = block.split('\n').map((line) => line.slice(2));
          return (
            <ul key={i}>
              {items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        // Otherwise: paragraph (line breaks inside are kept as-is).
        return <p key={i}>{renderInline(block.replace(/\n/g, ' '))}</p>;
      })}
    </>
  );
}

/** Inline pass: handles **bold** and *emphasis* with a one-shot tokenizer. */
function renderInline(text: string): React.ReactNode {
  // Order matters: ** before *. Split on **bold** first.
  const out: React.ReactNode[] = [];
  let cursor = 0;
  const bold = /\*\*([^*]+)\*\*/g;
  let match: RegExpExecArray | null;
  while ((match = bold.exec(text))) {
    if (match.index > cursor) out.push(splitItalic(text.slice(cursor, match.index), out.length));
    out.push(<strong key={`b${match.index}`}>{splitItalic(match[1], out.length + 1)}</strong>);
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) out.push(splitItalic(text.slice(cursor), out.length));
  return out;
}

/** Second inline pass: handle *emphasis* within a plain segment. */
function splitItalic(text: string, baseKey: number): React.ReactNode {
  const out: React.ReactNode[] = [];
  let cursor = 0;
  const em = /\*([^*]+)\*/g;
  let match: RegExpExecArray | null;
  while ((match = em.exec(text))) {
    if (match.index > cursor) out.push(<React.Fragment key={`t${baseKey}_${match.index}`}>{text.slice(cursor, match.index)}</React.Fragment>);
    out.push(<em key={`e${baseKey}_${match.index}`}>{match[1]}</em>);
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) {
    out.push(<React.Fragment key={`t${baseKey}_end`}>{text.slice(cursor)}</React.Fragment>);
  }
  return out.length === 1 ? out[0] : <>{out}</>;
}
