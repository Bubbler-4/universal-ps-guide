import MarkdownIt from "markdown-it";
import texmath from "markdown-it-texmath";
import katex from "katex";

/**
 * Renders a markdown string to HTML using the CommonMark preset.
 * - Raw HTML tags are disabled (html: false).
 * - Math expressions delimited by $…$ (inline) and $$…$$ (block) are rendered
 *   with KaTeX.
 */
const md = new MarkdownIt("commonmark", {
  html: false,        // disable raw HTML tags in user content
}).use(texmath, {
  engine: katex,
  delimiters: "dollars",
  katexOptions: { throwOnError: false },
});

export function renderMarkdown(content: string): string {
  return md.render(content);
}
