// Claude JSON → Markdown converter

import type { ClaudeConversation, ClaudeChatMessage, ContentBlock, SearchResult } from "../types/claude.js";
import { summarize, escapeTagBody } from "../lib/helpers.js";

/** 渲染单条消息 */
function renderMessage(msg: ClaudeChatMessage): string {
  const tag = msg.sender === "human" ? "human" : "assistant";
  const parts: string[] = [`<${tag}>`];

  for (const block of msg.content) {
    switch (block.type) {
      case "text": {
        const t = block.text.trim();
        if (t) parts.push(t);
        break;
      }

      case "thinking": {
        const summary = summarize(block.thinking);
        const body = escapeTagBody(block.thinking);
        parts.push(`<thinking summary="${summary}">`, body, `</thinking>`);
        break;
      }

      case "tool_use": {
        const query = block.input?.query ?? "";
        parts.push(`<tool-call name="${block.name}" query="${query}" />`);
        break;
      }

      case "tool_result": {
        const items = block.content ?? [];
        const links = items
          .slice(0, 5)
          .map((it: SearchResult) => `- [${it.title}](${it.url})`)
          .join("\n");
        const more = items.length > 5 ? `\n- … and ${items.length - 5} more` : "";
        parts.push(
          `<tool-result name="${block.name ?? "unknown"}" count="${items.length}">`,
          links + more,
          `</tool-result>`
        );
        break;
      }
    }
  }

  parts.push(`</${tag}>`, "");
  return parts.join("\n");
}

/** 整场对话 → Markdown + XML tags */
export function convertClaude(data: ClaudeConversation): string {
  const date = new Date(data.created_at).toISOString().split("T")[0];
  const msgCount = data.chat_messages.length;

  const header = [
    `# ${data.name}`,
    "",
    `> **Model:** ${data.model} | **Date:** ${date} | **Messages:** ${msgCount}`,
    `> **UUID:** \`${data.uuid}\``,
    "",
    "---",
    "",
  ].join("\n");

  return header + data.chat_messages.map(renderMessage).join("\n");
}
