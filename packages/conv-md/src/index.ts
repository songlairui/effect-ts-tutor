// CLI entry – conv-md: Convert conversation export JSON to XML-tagged Markdown

import { defineCommand, runMain } from "citty";
import * as fs from "node:fs";
import * as path from "node:path";
import { convertClaude } from "./convert/claude.js";
import { convertChatGPT } from "./convert/chatgpt.js";
import { ChatGPTConversationSchema } from "./validate/chatgpt.js";
import type { ClaudeConversation } from "./types/claude.js";
import type { ChatGPTConversation } from "./types/chatgpt.js";

// ── Shared helpers ────────────────────────────────────────────────────

function resolveOutput(inputPath: string, outputArg?: string): string {
  if (outputArg) return outputArg;
  const parsed = path.parse(inputPath);
  return path.join(parsed.dir, `${parsed.name}.md`);
}

function readJSON<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

function writeMarkdown(outputPath: string, markdown: string): void {
  fs.writeFileSync(outputPath, markdown, "utf-8");
  const sizeKB = (Buffer.byteLength(markdown) / 1024).toFixed(1);
  console.log(`✅ ${outputPath}  (${sizeKB} KB)`);
}

// ── Commands ──────────────────────────────────────────────────────────

const claudeCmd = defineCommand({
  meta: {
    name: "claude",
    description: "Convert Claude conversation export JSON to Markdown",
  },
  args: {
    input: {
      type: "positional",
      description: "Input JSON file path",
      required: true,
    },
    output: {
      type: "positional",
      description: "Output Markdown file path (default: same name .md)",
      required: false,
    },
  },
  run({ args }) {
    const data = readJSON<ClaudeConversation>(args.input);
    const markdown = convertClaude(data);
    writeMarkdown(resolveOutput(args.input, args.output), markdown);
  },
});

const chatgptCmd = defineCommand({
  meta: {
    name: "chatgpt",
    description: "Convert ChatGPT conversation export JSON to Markdown",
  },
  args: {
    input: {
      type: "positional",
      description: "Input JSON file path",
      required: true,
    },
    output: {
      type: "positional",
      description: "Output Markdown file path (default: same name .md)",
      required: false,
    },
  },
  run({ args }) {
    const data = readJSON<ChatGPTConversation>(args.input);
    const markdown = convertChatGPT(data);
    writeMarkdown(resolveOutput(args.input, args.output), markdown);
  },
});

const validateCmd = defineCommand({
  meta: {
    name: "validate",
    description: "Validate a ChatGPT conversation export JSON structure",
  },
  args: {
    input: {
      type: "positional",
      description: "Input JSON file path",
      required: true,
    },
  },
  run({ args }) {
    const data = readJSON<unknown>(args.input);
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
  },
});

// ── Main ──────────────────────────────────────────────────────────────

const main = defineCommand({
  meta: {
    name: "conv-md",
    version: "0.1.0",
    description: "Convert Claude / ChatGPT conversation export JSON to XML-tagged Markdown",
  },
  subCommands: {
    claude: claudeCmd,
    chatgpt: chatgptCmd,
    validate: validateCmd,
  },
});

runMain(main);
