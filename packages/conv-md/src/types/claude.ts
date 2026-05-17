// Claude conversation export types

export interface ClaudeConversation {
  uuid: string;
  name: string;
  summary: string;
  model: string;
  created_at: string;
  updated_at: string;
  settings: Record<string, unknown>;
  is_starred: boolean;
  is_temporary: boolean;
  platform: string;
  current_leaf_message_uuid: string;
  chat_messages: ClaudeChatMessage[];
}

export interface ClaudeChatMessage {
  uuid: string;
  text: string;
  content: ContentBlock[];
  sender: "human" | "assistant";
  index: number;
  created_at: string;
  updated_at: string;
  truncated: boolean;
  attachments: any[];
  files: any[];
  sync_sources: any[];
  parent_message_uuid: string;
  stop_reason?: string;
}

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string; signature?: string }
  | { type: "tool_use"; id?: string; name: string; input?: { query?: string } }
  | { type: "tool_result"; tool_use_id?: string; name?: string; content?: SearchResult[]; is_error?: boolean };

export interface SearchResult {
  title: string;
  url: string;
}
