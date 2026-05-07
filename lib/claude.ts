import Anthropic from "@anthropic-ai/sdk";

const usesGateway = Boolean(process.env.AI_GATEWAY_API_KEY);
const client = new Anthropic({
  apiKey: process.env.AI_GATEWAY_API_KEY || process.env.ANTHROPIC_API_KEY,
  baseURL: usesGateway ? "https://ai-gateway.vercel.sh" : undefined,
});

const MODEL =
  process.env.AI_GATEWAY_MODEL ||
  process.env.ANTHROPIC_MODEL ||
  (usesGateway ? "anthropic/claude-sonnet-4.5" : "claude-sonnet-4-5-20250929");

type CallOpts = {
  useWebSearch?: boolean;
  maxTokens?: number;
  onTextDelta?: (delta: string) => void;
};

/**
 * Call Claude and parse JSON response.
 * For Stage 1, enable web search so Claude can run the 5 mandated queries.
 */
export async function callClaudeJSON<T = any>(
  prompt: string,
  opts: CallOpts = {}
): Promise<T> {
  const { useWebSearch = false, maxTokens = 4096, onTextDelta } = opts;

  if (!process.env.AI_GATEWAY_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    throw new Error("AI_GATEWAY_API_KEY or ANTHROPIC_API_KEY is missing. Add one to .env.local or your Vercel environment variables.");
  }

  const params: any = {
    model: MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  };

  if (useWebSearch && MODEL.startsWith("anthropic/") === false && usesGateway) {
    console.warn("Web search is only enabled for Anthropic models. Falling back to model-only research.");
  } else if (useWebSearch) {
    params.tools = [{ type: "web_search_20250305", name: "web_search" }];
  }

  if (onTextDelta) {
    const text = await streamClaudeText(params, onTextDelta);
    return parseJSON<T>(text);
  }

  const response = await client.messages.create(params);

  // Extract all text blocks (web search tool calls produce intermediate blocks)
  const text = response.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n");

  return parseJSON<T>(text);
}

export function getClaudeRuntime() {
  return {
    routedVia: usesGateway ? "Vercel AI Gateway" : "Anthropic Direct",
    model: MODEL,
  };
}

async function streamClaudeText(params: any, onTextDelta: (delta: string) => void) {
  const stream = await client.messages.create({
    ...params,
    stream: true,
  });

  let text = "";
  for await (const event of stream as any) {
    if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
      text += event.delta.text;
      onTextDelta(event.delta.text);
    }
  }
  return text;
}

/**
 * Robust JSON extraction. Claude sometimes wraps in ```json fences or adds preamble.
 */
function parseJSON<T>(text: string): T {
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  // Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch {}

  // Fall back to finding the first complete JSON object
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch (err) {
      throw new Error(
        `Failed to parse Claude JSON response. Raw: ${cleaned.slice(0, 500)}`
      );
    }
  }

  throw new Error(
    `No JSON found in Claude response. Raw: ${cleaned.slice(0, 500)}`
  );
}
