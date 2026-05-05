export interface ClaudeTypes {
    uuid:                      string;
    name:                      string;
    summary:                   string;
    model:                     string;
    created_at:                Date;
    updated_at:                Date;
    settings:                  Settings;
    is_starred:                boolean;
    is_temporary:              boolean;
    platform:                  string;
    current_leaf_message_uuid: string;
    chat_messages:             ChatMessage[];
}

export interface ChatMessage {
    uuid:                string;
    text:                string;
    content:             ChatMessageContent[];
    sender:              string;
    index:               number;
    created_at:          Date;
    updated_at:          Date;
    input_mode:          InputMode;
    truncated:           boolean;
    attachments:         any[];
    files:               any[];
    sync_sources:        any[];
    parent_message_uuid: string;
    stop_reason?:        string;
}

export interface ChatMessageContent {
    start_timestamp?: Date;
    stop_timestamp?:  Date;
    type:             InputMode;
    text?:            string;
    citations?:       any[];
    thinking?:        string;
    summaries?:       Summary[];
    cut_off?:         boolean;
    truncated?:       boolean;
    signature?:       string;
    id?:              string;
    name?:            string;
    input?:           Input;
    message?:         string;
    icon_name?:       string;
    tool_use_id?:     string;
    content?:         ContentContent[];
    is_error?:        boolean;
}

export interface ContentContent {
    type:                    ContentType;
    title:                   string;
    url:                     string;
    metadata:                Metadata;
    is_missing:              boolean;
    text:                    string;
    is_citable:              boolean;
    prompt_context_metadata: PromptContextMetadata;
}

export interface Metadata {
    type:        MetadataType;
    site_domain: string;
    favicon_url: string;
    site_name:   string;
}

export enum MetadataType {
    WebpageMetadata = "webpage_metadata",
}

export interface PromptContextMetadata {
    url:             string;
    search_provider: SearchProvider;
    age?:            string;
}

export enum SearchProvider {
    Anthropic = "anthropic",
}

export enum ContentType {
    Knowledge = "knowledge",
}

export interface Input {
    query: string;
}

export interface Summary {
    summary: string;
}

export enum InputMode {
    Text = "text",
    Thinking = "thinking",
    ToolResult = "tool_result",
    ToolUse = "tool_use",
}

export interface Settings {
    enabled_web_search:             boolean;
    paprika_mode:                   string;
    enabled_monkeys_in_a_barrel:    boolean;
    enabled_saffron:                boolean;
    tool_search_mode:               string;
    preview_feature_uses_artifacts: boolean;
    enabled_turmeric:               boolean;
}
