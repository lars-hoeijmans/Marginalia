interface ParsedNote {
  title: string;
  body: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function parseTxtFile(content: string): ParsedNote {
  const lines = content.split(/\r?\n/);
  const title = lines[0]?.trim() ?? "Untitled";
  const body = lines
    .slice(1)
    .join("\n")
    .trim();

  return {
    title: escapeHtml(title),
    body: escapeHtml(body).replace(/\n/g, "<br>"),
  };
}

export function parseMdFile(content: string): ParsedNote {
  const lines = content.split(/\r?\n/);

  // Extract title: first # heading, or first non-empty line
  let title = "Untitled";
  let bodyStartIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === "") continue;

    const headingMatch = trimmed.match(/^#\s+(.+)/);
    if (headingMatch) {
      title = headingMatch[1];
      bodyStartIndex = i + 1;
    } else {
      title = trimmed;
      bodyStartIndex = i + 1;
    }
    break;
  }

  const bodyRaw = lines
    .slice(bodyStartIndex)
    .join("\n")
    .trim();

  // Convert basic markdown to HTML
  const body = escapeHtml(bodyRaw)
    // Bold: **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/__(.+?)__/g, "<b>$1</b>")
    // Italic: *text* or _text_ (not inside bold markers)
    .replace(/\*(.+?)\*/g, "<i>$1</i>")
    .replace(/(?<![a-zA-Z0-9])_(.+?)_(?![a-zA-Z0-9])/g, "<i>$1</i>")
    // Strip remaining markdown syntax (headings, list markers, horizontal rules)
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/^---+$/gm, "")
    // Newlines to <br>
    .replace(/\n/g, "<br>");

  return { title, body };
}

export function parseFile(filename: string, content: string): ParsedNote {
  if (filename.endsWith(".md")) {
    return parseMdFile(content);
  }
  return parseTxtFile(content);
}
