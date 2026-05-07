import { NextRequest } from "next/server";
import { callClaudeJSON } from "@/lib/claude";
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

type StreamEvent = {
  type: "progress" | "stage" | "done" | "error";
  step?: string;
  status?: "processing" | "done" | "skipped" | "error";
  payload?: any;
  message?: string;
  processing_time_ms?: number;
};

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const input: ContactInput = await req.json();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        if (!input.company_name && !input.first_name) {
          send({ type: "error", status: "error", message: "company_name or first_name required" });
          controller.close();
          return;
        }

        send({ type: "progress", status: "processing", step: "Searching public evidence..." });
        const stage1 = await callClaudeJSON(buildStage1Prompt(input), {
          useWebSearch: true,
          maxTokens: 4096,
        });
        send({ type: "stage", status: "processing", step: "Research complete", payload: { stage1 } });

        send({ type: "progress", status: "processing", step: "Synthesizing narrative..." });
        const stage2 = await callClaudeJSON(buildStage2Prompt(stage1, input), {
          maxTokens: 1024,
        });
        send({ type: "stage", status: "processing", step: "Narrative ready", payload: { stage2 } });

        if (
          stage1.confidence === "low" ||
          stage2?.send_recommendation === "SKIP" ||
          !stage2?.narrative
        ) {
          send({
            type: "done",
            status: "skipped",
            step: "Skipped - insufficient signal",
            payload: { stage1, stage2 },
            processing_time_ms: Date.now() - startTime,
          });
          controller.close();
          return;
        }

        send({ type: "progress", status: "processing", step: "Generating outreach..." });
        const [email, linkedin, coldcall] = await Promise.all([
          callClaudeJSON(buildEmailPrompt(input, stage2, stage1), { maxTokens: 1024 }),
          callClaudeJSON(buildLinkedInPrompt(input, stage2, stage1), { maxTokens: 512 }),
          callClaudeJSON(buildColdCallPrompt(input, stage2, stage1), { maxTokens: 1024 }),
        ]);

        send({
          type: "done",
          status: "done",
          step: "Complete",
          payload: { stage1, stage2, email, linkedin, coldcall },
          processing_time_ms: Date.now() - startTime,
        });
        controller.close();
      } catch (err: any) {
        send({
          type: "error",
          status: "error",
          step: "Processing error",
          message: err.message || "Unknown error",
          processing_time_ms: Date.now() - startTime,
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
