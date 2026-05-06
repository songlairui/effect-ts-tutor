/**
 * validate-chatgpt-json.ts
 * 用 Zod 验证 ChatGPT 对话导出 JSON 的结构。
 *
 * 用法:
 *   npx tsx scripts/validate-chatgpt-json.ts <input.json>
 */

import * as fs from "node:fs";
import { z } from "zod";

// ── Content schemas (discriminated by content_type) ──────────────────

const TextContentSchema = z.object({
  content_type: z.literal("text"),
  parts: z.array(z.string()),
});

const ModelEditableContextContentSchema = z.object({
  content_type: z.literal("model_editable_context"),
  model_set_context: z.string(),
  repository: z.null(),
  repo_summary: z.null(),
  structured_context: z.null(),
});

const ReasoningRecapContentSchema = z.object({
  content_type: z.literal("reasoning_recap"),
  content: z.string(),
});

const ThoughtsContentSchema = z.object({
  content_type: z.literal("thoughts"),
  thoughts: z.array(z.any()),
  source_analysis_msg_id: z.string(),
});

const ContentSchema = z.discriminatedUnion("content_type", [
  TextContentSchema,
  ModelEditableContextContentSchema,
  ReasoningRecapContentSchema,
  ThoughtsContentSchema,
]);

// ── Message schema ───────────────────────────────────────────────────

const AuthorSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  name: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
});

const CodeBlockSchema = z.object({
  id: z.string(),
  edited: z.boolean(),
  previewable: z.boolean(),
  preview_language: z.null(),
});

const FinishDetailsSchema = z.object({
  type: z.string(),
  stop_tokens: z.array(z.number()),
});

const SearchModelQueriesSchema = z.object({
  type: z.string(),
  queries: z.array(z.string()),
});

const PermissionSchema = z.object({
  type: z.string(),
  status: z.string(),
  notification_channel_id: z.string(),
  notification_channel_name: z.string(),
  notification_priority: z.number(),
});

const MessageMetadataSchema = z.object({
  is_visually_hidden_from_conversation: z.boolean().optional(),
  is_contextual_answers_system_message: z.boolean().optional(),
  contextual_answers_message_type: z.string().optional(),
  rebase_developer_message: z.boolean().optional(),
  command: z.string().optional(),
  request_id: z.string().optional(),
  message_type: z.string().optional(),
  turn_exchange_id: z.string().optional(),
  message_source: z.null().optional(),
  parent_id: z.string().optional(),
  model_slug: z.string().optional(),
  default_model_slug: z.string().optional(),
  resolved_model_slug: z.string().optional(),
  reasoning_status: z.string().optional(),
  reasoning_start_time: z.number().optional(),
  reasoning_end_time: z.number().optional(),
  is_thinking_preamble_message: z.boolean().optional(),
  finish_details: FinishDetailsSchema.optional(),
  is_complete: z.boolean().optional(),
  finished_duration_sec: z.number().optional(),
  citations: z.array(z.any()).optional(),
  content_references: z.array(z.any()).optional(),
  code_blocks: z.record(z.string(), CodeBlockSchema).optional(),
  search_result_groups: z.array(z.any()).optional(),
  search_model_queries: SearchModelQueriesSchema.optional(),
  story_events: z.array(z.any()).optional(),
  safe_urls: z.array(z.string()).optional(),
  hide_inline_actions: z.boolean().optional(),
  disable_turn_actions: z.boolean().optional(),
  can_save: z.boolean(),
  model_switcher_deny: z.array(z.any()).optional(),
  dictation: z.boolean().optional(),
  triggered_by_system_hint_suggestion: z.boolean().optional(),
  chime_version: z.number().optional(),
  permissions: z.array(PermissionSchema).optional(),
  skip_reasoning_title: z.string().optional(),
  classifier_response: z.string().optional(),
});

const MessageSchema = z.object({
  id: z.string(),
  author: AuthorSchema,
  create_time: z.number().nullable(),
  update_time: z.number().nullable(),
  content: ContentSchema,
  status: z.string(),
  end_turn: z.boolean().nullable(),
  weight: z.number(),
  metadata: MessageMetadataSchema,
  recipient: z.string(),
  channel: z.string().nullable(),
});

// ── Mapping node schema ──────────────────────────────────────────────

const MappingNodeSchema: z.ZodType = z.object({
  id: z.string(),
  message: MessageSchema.nullable(),
  parent: z.string().nullable(),
  children: z.array(z.string()),
});

// ── Top-level conversation schema ────────────────────────────────────

const ChatGPTConversationSchema = z.object({
  title: z.string(),
  create_time: z.number(),
  update_time: z.number(),
  moderation_results: z.array(z.any()),
  plugin_ids: z.null(),
  conversation_id: z.string(),
  conversation_template_id: z.null(),
  gizmo_id: z.null(),
  gizmo_type: z.null(),
  is_archived: z.boolean(),
  is_starred: z.null(),
  safe_urls: z.array(z.string()),
  blocked_urls: z.array(z.any()),
  default_model_slug: z.string(),
  atlas_mode_enabled: z.null(),
  conversation_origin: z.null(),
  is_read_only: z.null(),
  voice: z.null(),
  async_status: z.null(),
  disabled_tool_ids: z.array(z.any()),
  is_temporary_chat: z.boolean(),
  is_do_not_remember: z.boolean(),
  memory_scope: z.string(),
  context_scopes: z.array(z.any()),
  sugar_item_id: z.null(),
  sugar_item_visible: z.boolean(),
  pinned_time: z.null(),
  is_study_mode: z.boolean(),
  owner: z.null(),
  mapping: z.record(z.string(), MappingNodeSchema),
  current_node: z.string(),
});

// ── CLI ───────────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log("Usage: npx tsx scripts/validate-chatgpt-json.ts <input.json>");
    process.exit(0);
  }

  const inputPath = args[0];
  if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, "utf-8");
  const data = JSON.parse(raw) as unknown;

  const result = ChatGPTConversationSchema.safeParse(data);

  if (result.success) {
    const nodeCount = Object.keys(result.data.mapping).length;
    console.log(`✅ Valid ChatGPT conversation export`);
    console.log(`   Title: ${result.data.title}`);
    console.log(`   Model: ${result.data.default_model_slug}`);
    console.log(`   Nodes: ${nodeCount}`);
    console.log(`   Conversation ID: ${result.data.conversation_id}`);
  } else {
    console.error("❌ Invalid ChatGPT conversation export:");
    console.error(result.error.issues);
    process.exit(1);
  }
}

main();
