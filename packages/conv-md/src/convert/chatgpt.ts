// ChatGPT JSON → Markdown converter

import type {
  ChatGPTConversation,
  MappingNode,
  Content,
  ModelEditableContextContent,
  ReasoningRecapContent,
  ThoughtsContent,
} from "../types/chatgpt.js";
import { summarize, escapeTagBody } from "../lib/helpers.js";

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

interface CollectedMsg {
  role: string;
  name: string | null;
  content: Content;
  metadata: Record<string, unknown>;
}

/**
 * 从 root 遍历到 current_node，按顺序收集可见消息。
 * 跳过 message 为 null 的占位节点、is_visually_hidden 的 system 消息。
 */
function collectMessages(data: ChatGPTConversation): CollectedMsg[] {
  const { mapping, current_node } = data;
  const path = pathToRoot(mapping, current_node);

  const result: CollectedMsg[] = [];

  for (const nodeId of path) {
    const node = mapping[nodeId];
    if (!node?.message) continue;

    const msg = node.message;
    const role = msg.author.role;
    const metadata = msg.metadata as unknown as Record<string, unknown>;

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

// ── Rendering ─────────────────────────────────────────────────────────

function renderText(text: string): string {
  return text.trim();
}

function renderThoughts(content: ThoughtsContent): string {
  const thoughtCount = content.thoughts?.length ?? 0;
  if (thoughtCount === 0) return "";
  const body = escapeTagBody(JSON.stringify(content.thoughts, null, 2));
  return `<thinking count="${thoughtCount}">\n${body}\n</thinking>`;
}

function renderReasoning(content: ReasoningRecapContent): string {
  const text = content.content ?? "";
  if (!text.trim()) return "";
  return `<reasoning summary="${escapeTagBody(summarize(text))}">${escapeTagBody(text)}</reasoning>`;
}

function renderModelContext(content: ModelEditableContextContent): string {
  const ctx = content.model_set_context ?? "";
  if (!ctx.trim()) return "";
  return `<model-context>\n${escapeTagBody(ctx)}\n</model-context>`;
}

function renderToolContent(metadata: Record<string, unknown>): string {
  const queries = metadata.search_model_queries as { queries?: string[] } | undefined;
  const queryList = queries?.queries ?? [];
  return queryList.map((q) => `- \`${q}\``).join("\n");
}

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
        if (role === "tool" && name) return renderToolContent(metadata);
        return null;
      }
      if (role === "tool") return renderToolContent(metadata);
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

function roleTag(role: string): string {
  switch (role) {
    case "user": return "human";
    case "assistant": return "assistant";
    case "tool": return "tool-call";
    default: return role;
  }
}

function renderMessage(msg: CollectedMsg): string {
  const tag = roleTag(msg.role);
  const block = renderBlock(msg.role, msg.name, msg.content, msg.metadata);
  if (!block) return "";

  const nameAttr = msg.name ? ` name="${msg.name}"` : "";
  return `<${tag}${nameAttr}>\n${block}\n</${tag}>\n`;
}

/** 整场对话 → Markdown + XML tags */
export function convertChatGPT(data: ChatGPTConversation): string {
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
