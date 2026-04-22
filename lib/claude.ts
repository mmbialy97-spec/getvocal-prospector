import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-sonnet-4-5-20250929";

type CallOpts = {
  useWebSearch?: boolean;
  maxTokens?: number;
};

/**
 * Call Claude and parse JSON response.
 * For Stage 1, enable web search so Claude can run the 5 mandated queries.
 */
export async function callClaudeJSON<T = any>(
  prompt: string,
  opts: CallOpts = {}
): Promise<T> {
  const { useWebSearch = false, maxTokens = 4096 } = opts;

  const params: any = {
    model: MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  };

  if (useWebSearch) {
    params.tools = [{ type: "web_search_20250305", name: "web_search" }];
  }

  const response = await client.messages.create(params);

  // Extract all text blocks (web search tool calls produce intermediate blocks)
  const text = response.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n");

  return parseJSON<T>(text);
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
