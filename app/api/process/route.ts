import { NextRequest, NextResponse } from "next/server";
import { callClaudeJSON } from "@/lib/claude";
import {
  buildStage1Prompt,
  buildStage2Prompt,
  buildEmailPrompt,
  buildLinkedInPrompt,
  buildColdCallPrompt,
  ContactInput,
} from "@/lib/prompts";

// Vercel: 60s on hobby, 300s on pro
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * POST /api/process
 * Body: ContactInput
 * Returns: { stage1, stage2, email?, linkedin?, coldcall?, processing_time_ms }
 *
 * Runs all 3 stages for one contact and returns the full result.
 * No DB — client stores results in IndexedDB.
 */
export async function POST(req: NextRequest) {
  const start = Date.now();

  try {
    const input: ContactInput = await req.json();

    if (!input.company_name && !input.first_name) {
      return NextResponse.json(
        { error: "company_name or first_name required" },
        { status: 400 }
      );
    }

    // Stage 1 — Research (web search enabled)
    let stage1: any;
    try {
      stage1 = await callClaudeJSON(buildStage1Prompt(input), {
        useWebSearch: true,
        maxTokens: 4096,
      });
    } catch (err: any) {
      return NextResponse.json(
        { error: "stage1_failed", message: err.message },
        { status: 500 }
      );
    }

    // Stage 2 — Synthesis
    let stage2: any;
    try {
      stage2 = await callClaudeJSON(buildStage2Prompt(stage1), {
        maxTokens: 1024,
      });
    } catch (err: any) {
      return NextResponse.json(
        { error: "stage2_failed", message: err.message, stage1 },
        { status: 500 }
      );
    }

    // If SKIP, stop here
    if (stage2?.send_recommendation === "SKIP" || !stage2?.narrative) {
      return NextResponse.json({
        stage1,
        stage2,
        status: "skipped",
        processing_time_ms: Date.now() - start,
      });
    }

    // Stage 3 — all 3 channels in parallel
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
      return NextResponse.json(
        {
          error: "stage3_failed",
          message: err.message,
          stage1,
          stage2,
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
      processing_time_ms: Date.now() - start,
    });
  } catch (err: any) {
    console.error("Process error:", err);
    return NextResponse.json(
      { error: "unexpected", message: err.message },
      { status: 500 }
    );
  }
}
