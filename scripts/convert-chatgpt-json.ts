/**
 * convert-chatgpt-json.ts
 * 将 ChatGPT 对话导出 JSON 转换为 XML-tag 包裹的 Markdown。
 *
 * 用法:
 *   npx tsx scripts/convert-chatgpt-json.ts <input.json> [output.md]
 *   bun run scripts/convert-chatgpt-json.ts <input.json> [output.md]
 *
 * 不传 output 则自动推导为同名 .md。
 *
 * 设计:
 *  - 用 <human> / <assistant> / <tool-call> 包裹每条消息
 *  - <model-context> / <reasoning> 折叠辅助信息
 *  - 正文原样保留，不做任何转义或层级篡改
 *  - 沿 mapping 树从 root → current_node 遍历，隐藏 system 消息自动跳过
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ChatGPTConversation, MappingNode, Content } from "./chatgpt-types.js";

// ── Traversal ────────────────────────────────────────────────────────

/** 沿着 current_node 路径收集所有祖先节点 id（含自身） */
function pathToRoot(
  mapping: Record<string, MappingNode>,
  current: string,
): string[] {
  const path: string[] = [];
  let cursor: string | null = current;
  while (cursor) {
    path.unshift(cursor);
    cursor = mapping[cursor]?.parent ?? null;
  }
  return path;
}

/**
 * 从 root (parent=null) 遍历到 current_node，按顺序收集可见消息。
 * 跳过 message 为 null 的占位节点、is_visually_hidden 的 system 消息。
 */
function collectMessages(
  data: ChatGPTConversation,
): Array<{ role: string; name: string | null; content: Content; metadata: Record<string, unknown> }> {
  const { mapping, current_node } = data;
  const path = pathToRoot(mapping, current_node);

  const result: Array<{
    role: string;
    name: string | null;
    content: Content;
    metadata: Record<string, unknown>;
  }> = [];

  for (const nodeId of path) {
    const node = mapping[nodeId];
    if (!node?.message) continue;

    const msg = node.message;
    const role = msg.author.role;
    const metadata = msg.metadata as Record<string, unknown>;

    // 跳过视觉隐藏的 system 消息（prompt 注入、context 注入等）
    if (role === "system" && metadata.is_visually_hidden_from_conversation) {
      continue;
    }

    result.push({
      role,
      name: msg.author.name,
      content: msg.content,
      metadata,
    });
  }

  return result;
}

// ── Helpers ──────────────────────────────────────────────────────────

/** 首句摘要 (截断 120 字符) */
function summarize(text: string, max = 120): string {
  const firstSentence = text.split(/[。.!?！？\n]/)[0] ?? "";
  const trimmed = firstSentence.slice(0, max).trim();
  return trimmed.length < firstSentence.trim().length ? trimmed + "…" : trimmed;
}

/** 转义 XML 标签体内出现的 "</" 防止提前闭合 */
function escapeTagBody(text: string): string {
  return text.replace(/<\//g, "<\\/");
}

// ── Rendering ─────────────────────────────────────────────────────────

function renderText(text: string): string {
  return text.trim();
}

function renderThoughts(content: Content & { content_type: "thoughts" }): string {
  const thoughtCount = content.thoughts?.length ?? 0;
  if (thoughtCount === 0) return "";
  const body = escapeTagBody(JSON.stringify(content.thoughts, null, 2));
  return `<thinking count="${thoughtCount}">\n${body}\n</thinking>`;
}

function renderReasoning(content: Content & { content_type: "reasoning_recap" }): string {
  const text = content.content ?? "";
  if (!text.trim()) return "";
  return `<reasoning summary="${escapeTagBody(summarize(text))}">${escapeTagBody(text)}</reasoning>`;
}

function renderModelContext(content: Content & { content_type: "model_editable_context" }): string {
  const ctx = content.model_set_context ?? "";
  if (!ctx.trim()) return "";
  return `<model-context>\n${escapeTagBody(ctx)}\n</model-context>`;
}

/** 渲染 tool 消息的内部内容，外层由 renderMessage 统一包裹 */
function renderToolContent(metadata: Record<string, unknown>): string {
  const queries = metadata.search_model_queries as { queries?: string[] } | undefined;
  const queryList = queries?.queries ?? [];
  return queryList.map((q) => `- \`${q}\``).join("\n");
}

/** 渲染单条内容块 */
function renderBlock(
  role: string,
  name: string | null,
  content: Content,
  metadata: Record<string, unknown>,
): string | null {
  switch (content.content_type) {
    case "text": {
      const text = content.parts.join("").trim();
      if (!text) {
        // 空的 tool 消息仍然展示内容
        if (role === "tool" && name) {
          return renderToolContent(metadata);
        }
        return null;
      }
      if (role === "tool") {
        return renderToolContent(metadata);
      }
      return renderText(text);
    }

    case "thoughts":
      return renderThoughts(content);

    case "reasoning_recap":
      return renderReasoning(content);

    case "model_editable_context":
      return renderModelContext(content);

    default:
      return null;
  }
}

/** 角色 → XML tag 名称 */
function roleTag(role: string): string {
  switch (role) {
    case "user":
      return "human";
    case "assistant":
      return "assistant";
    case "tool":
      return "tool-call";
    default:
      return role;
  }
}

/** 渲染单条消息（可能包含多个 content block，ChatGPT 目前一条消息只有一个 content） */
function renderMessage(msg: {
  role: string;
  name: string | null;
  content: Content;
  metadata: Record<string, unknown>;
}): string {
  const tag = roleTag(msg.role);
  const block = renderBlock(msg.role, msg.name, msg.content, msg.metadata);
  if (!block) return "";

  const nameAttr = msg.name ? ` name="${msg.name}"` : "";
  return `<${tag}${nameAttr}>\n${block}\n</${tag}>\n`;
}

/** 整场对话 → Markdown + XML tags */
function convert(data: ChatGPTConversation): string {
  const messages = collectMessages(data);

  const date = new Date(data.create_time * 1000).toISOString().split("T")[0];
  const msgCount = messages.length;

  const header = [
    `# ${data.title}`,
    "",
    `> **Model:** ${data.default_model_slug} | **Date:** ${date} | **Messages:** ${msgCount}`,
    `> **Conversation ID:** \`${data.conversation_id}\``,
    "",
    "---",
    "",
  ].join("\n");

  return header + messages.map(renderMessage).filter(Boolean).join("\n");
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
    console.log("Usage: npx tsx scripts/convert-chatgpt-json.ts <input.json> [output.md]");
    process.exit(0);
  }

  const inputPath = args[0];
  if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, "utf-8");
  const data = JSON.parse(raw) as ChatGPTConversation;
  const markdown = convert(data);

  const outputPath = resolveOutput(inputPath, args[1]);
  fs.writeFileSync(outputPath, markdown, "utf-8");

  const sizeKB = (Buffer.byteLength(markdown) / 1024).toFixed(1);
  console.log(`✅ ${outputPath}  (${sizeKB} KB)`);
}

main();
