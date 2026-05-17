// Shared helpers for rendering

/** 首句摘要 (截断 120 字符) */
export function summarize(text: string, max = 120): string {
  const firstSentence = text.split(/[。.!?！？\n]/)[0] ?? "";
  const trimmed = firstSentence.slice(0, max).trim();
  return trimmed.length < firstSentence.trim().length ? trimmed + "…" : trimmed;
}

/** 转义 XML 标签体内出现的 "</" 防止提前闭合 */
export function escapeTagBody(text: string): string {
  return text.replace(/<\//g, "<\\/");
}
