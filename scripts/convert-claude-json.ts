/**
 * convert-claude-json.ts
 * 将 Claude 对话导出 JSON 转换为 XML-tag 包裹的 Markdown。
 *
 * 用法:
 *   npx tsx scripts/convert-claude-json.ts <input.json> [output.md]
 *   bun run scripts/convert-claude-json.ts <input.json> [output.md]
 *
 * 不传 output 则自动推导为同名 .md。
 *
 * 设计:
 *  - 用 <human> / <assistant> 包裹每条消息，内部 markdown 零冲突
 *  - <thinking> / <tool-call> / <tool-result> 折叠冗余信息
 *  - 正文原样保留，不做任何转义或层级篡改
 */

import * as fs from "node:fs";
import * as path from "node:path";

// ── Types ─────────────────────────────────────────────────────────────

interface ClaudeConversation {
  uuid: string;
  name: string;
  model: string;
  created_at: string;
  chat_messages: ChatMessage[];
}

interface ChatMessage {
  sender: "human" | "assistant";
  content: ContentBlock[];
}

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string }
  | { type: "tool_use"; name: string; input?: { query?: string } }
  | { type: "tool_result"; name: string; content?: SearchResult[] };

interface SearchResult {
  title: string;
  url: string;
}

// ── Rendering ─────────────────────────────────────────────────────────

/** thinking 首句摘要 (截断 120 字符) */
function summarize(text: string, max = 120): string {
  const firstSentence = text.split(/[。.!?！？\n]/)[0] ?? "";
  const trimmed = firstSentence.slice(0, max).trim();
  return trimmed.length < firstSentence.trim().length ? trimmed + "…" : trimmed;
}

/** 对 XML 标签体内出现的 "</" 做最小转义，防止提前闭合 */
function escapeTagBody(text: string): string {
  return text.replace(/<\//g, "<\\/");
}

/** 渲染单条消息 */
function renderMessage(msg: ChatMessage): string {
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
          .map((it) => `- [${it.title}](${it.url})`)
          .join("\n");
        const more = items.length > 5 ? `\n- … and ${items.length - 5} more` : "";
        parts.push(
          `<tool-result name="${block.name}" count="${items.length}">`,
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
function convert(data: ClaudeConversation): string {
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

// ── CLI ───────────────────────────────────────────────────────────────

function resolveOutput(inputPath: string, outputArg?: string): string {
  if (outputArg) return outputArg;
  const parsed = path.parse(inputPath);
  return path.join(parsed.dir, `${parsed.name}.md`);
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log("Usage: npx tsx convert-claude-json.ts <input.json> [output.md]");
    process.exit(0);
  }

  const inputPath = args[0];
  if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, "utf-8");
  const data = JSON.parse(raw) as ClaudeConversation;
  const markdown = convert(data);

  const outputPath = resolveOutput(inputPath, args[1]);
  fs.writeFileSync(outputPath, markdown, "utf-8");

  const sizeKB = (Buffer.byteLength(markdown) / 1024).toFixed(1);
  console.log(`✅ ${outputPath}  (${sizeKB} KB)`);
}

main();
