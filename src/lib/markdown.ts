import MarkdownIt from "markdown-it";
import texmath from "markdown-it-texmath";
import katex from "katex";

/**
 * Renders a CommonMark markdown string to HTML.
 * - Raw HTML tags are disabled (html: false).
 * - Math expressions delimited by $…$ (inline) and $$…$$ (block) are rendered
 *   with KaTeX.
 */
const md = new MarkdownIt({
  html: false,        // disable raw HTML tags in user content
  linkify: true,
  typographer: false,
}).use(texmath, {
  engine: katex,
  delimiters: "dollars",
  katexOptions: { throwOnError: false },
});

export function renderMarkdown(content: string): string {
  return md.render(content);
}
