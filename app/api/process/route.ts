// app/api/process/route.ts
// Vercel EMEA Startups GTM Prospector
// Architecture: 3 sequential stages, client-orchestrated, one contact per call
// Stage 1: 5 web searches → infra/deploy signals (web search enabled)
// Stage 2: synthesise strongest outreach narrative
// Stage 3: 3 parallel channel outputs (email, LinkedIn, cold call)

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  buildStage1Prompt,
  buildStage2Prompt,
  buildEmailPrompt,
  buildLinkedInPrompt,
  buildColdCallPrompt,
  ContactInput,
} from "@/lib/prompts";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// ─── Claude caller ────────────────────────────────────────────────────────
async function callClaudeJSON(
  prompt: string,
  options: { useWebSearch?: boolean; maxTokens?: number } = {}
): Promise<any> {
  const { useWebSearch = false, maxTokens = 2048 } = options;

  const tools: any[] = useWebSearch
    ? [{ type: "web_search_20250305", name: "web_search" }]
    : [];

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: maxTokens,
    ...(tools.length > 0 ? { tools } : {}),
    messages: [{ role: "user", content: prompt }],
  });

  // Extract text blocks from response (skip tool_use and tool_result blocks)
  const textContent = response.content
    .filter((block: any) => block.type === "text")
    .map((block: any) => block.text)
    .join("");

  if (!textContent) {
    throw new Error("No text content in Claude response");
  }

  // Strip markdown fences if present
  const cleaned = textContent
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  // Find the JSON object
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error(`No JSON object found in response: ${cleaned.slice(0, 200)}`);
  }

  return JSON.parse(cleaned.slice(start, end + 1));
}

// ─── POST /api/process ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const input: ContactInput = await req.json();

    if (!input.company_name && !input.first_name) {
      return NextResponse.json(
        { error: "company_name or first_name required" },
        { status: 400 }
      );
    }

    // ── Stage 1: Research (web search enabled) ──────────────────────────
    let stage1: any;
    try {
      stage1 = await callClaudeJSON(buildStage1Prompt(input), {
        useWebSearch: true,
        maxTokens: 4096,
      });
    } catch (err: any) {
      console.error("Stage 1 failed:", err);
      return NextResponse.json(
        {
          error: "stage1_failed",
          message: err.message,
          status: "error",
          processing_time_ms: Date.now() - startTime,
        },
        { status: 500 }
      );
    }

    // ── Stage 2: Synthesis ───────────────────────────────────────────────
    let stage2: any;
    try {
      stage2 = await callClaudeJSON(buildStage2Prompt(stage1), {
        maxTokens: 1024,
      });
    } catch (err: any) {
      console.error("Stage 2 failed:", err);
      return NextResponse.json(
        {
          error: "stage2_failed",
          message: err.message,
          stage1,
          status: "error",
          processing_time_ms: Date.now() - startTime,
        },
        { status: 500 }
      );
    }

    // If confidence too low or explicit SKIP, stop here
    if (
      stage1.confidence === "low" ||
      stage2?.send_recommendation === "SKIP" ||
      !stage2?.narrative
    ) {
      return NextResponse.json({
        stage1,
        stage2,
        status: "skipped",
        processing_time_ms: Date.now() - startTime,
      });
    }

    // ── Stage 3: 3-channel generation (parallel) ─────────────────────────
    let email: any, linkedin: any, coldcall: any;
    try {
      [email, linkedin, coldcall] = await Promise.all([
        callClaudeJSON(buildEmailPrompt(input, stage2, stage1), {
          maxTokens: 1024,
        }),
        callClaudeJSON(buildLinkedInPrompt(input, stage2, stage1), {
          maxTokens: 512,
        }),
        callClaudeJSON(buildColdCallPrompt(input, stage2, stage1), {
          maxTokens: 1024,
        }),
      ]);
    } catch (err: any) {
      console.error("Stage 3 failed:", err);
      return NextResponse.json(
        {
          error: "stage3_failed",
          message: err.message,
          stage1,
          stage2,
          status: "error",
          processing_time_ms: Date.now() - startTime,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      stage1,
      stage2,
      email,
      linkedin,
      coldcall,
      status: "done",
      processing_time_ms: Date.now() - startTime,
    });

  } catch (err: any) {
    console.error("Unexpected error in /api/process:", err);
    return NextResponse.json(
      {
        error: "unexpected",
        message: err.message,
        status: "error",
        processing_time_ms: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
