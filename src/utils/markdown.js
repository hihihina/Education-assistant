import DOMPurify from "dompurify";
import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: true,
});

export function renderMarkdown(content) {
  const source = String(content || "").trim();
  if (!source) return "";
  return DOMPurify.sanitize(marked.parse(source));
}
