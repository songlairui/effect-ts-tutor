// Zod schemas for validating ChatGPT conversation exports

import { z } from "zod";

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

const AuthorSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  name: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
});

const MessageMetadataSchema = z.object({
  is_visually_hidden_from_conversation: z.boolean().optional(),
  command: z.string().optional(),
  request_id: z.string().optional(),
  message_type: z.string().optional(),
  model_slug: z.string().optional(),
  default_model_slug: z.string().optional(),
  resolved_model_slug: z.string().optional(),
  reasoning_status: z.string().optional(),
  finish_details: z.object({ type: z.string(), stop_tokens: z.array(z.number()) }).optional(),
  is_complete: z.boolean().optional(),
  search_model_queries: z.object({ type: z.string(), queries: z.array(z.string()) }).optional(),
  can_save: z.boolean(),
  dictation: z.boolean().optional(),
  permissions: z.array(z.object({
    type: z.string(),
    status: z.string(),
    notification_channel_id: z.string(),
    notification_channel_name: z.string(),
    notification_priority: z.number(),
  })).optional(),
}).passthrough();

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

const MappingNodeSchema: z.ZodType = z.object({
  id: z.string(),
  message: MessageSchema.nullable(),
  parent: z.string().nullable(),
  children: z.array(z.string()),
});

export const ChatGPTConversationSchema = z.object({
  title: z.string(),
  create_time: z.number(),
  update_time: z.number(),
  conversation_id: z.string(),
  default_model_slug: z.string(),
  is_temporary_chat: z.boolean(),
  mapping: z.record(z.string(), MappingNodeSchema),
  current_node: z.string(),
}).passthrough();
