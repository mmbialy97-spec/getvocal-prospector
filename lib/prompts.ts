// lib/prompts.ts
// Vercel EMEA Startups GTM Prospector

export type ContactInput = {
  first_name: string;
  last_name: string;
  company_name: string;
  website: string;
  title: string;
  linkedin_url: string;
  campaign_persona?: string;
  campaign_offer?: string;
};

const OFFER_CONTEXT: Record<string, { label: string; description: string; proofPoints: string[]; signals: string[] }> = {
  infra: {
    label: "Infra",
    description: "Position Vercel as the fastest path to reliable frontend infrastructure, preview deployments, CI/CD simplification, and global performance.",
    proofPoints: [
      "Preview deployments: every PR gets a live URL for product, design, and engineering review",
      "Managed frontend infrastructure removes CI/CD, build, and hosting plumbing from engineering teams",
      "Edge Network serves globally without a separate platform team",
    ],
    signals: ["frontend/platform hiring", "Next.js or React usage", "recent funding or headcount growth", "performance or latency pressure"],
  },
  ai_gateway: {
    label: "AI Gateway",
    description: "Position Vercel AI Gateway as a control plane for routing, observability, reliability, and cost management across model providers.",
    proofPoints: [
      "AI Gateway gives teams one place to route and monitor model calls across providers",
      "Centralized observability helps teams debug latency, cost, and provider reliability",
      "Provider flexibility reduces lock-in as AI product usage scales",
    ],
    signals: ["AI product launches", "LLM or agent hiring", "multi-provider AI stack mentions", "latency, reliability, or cost concerns around AI features"],
  },
  fluid_compute: {
    label: "Fluid Compute",
    description: "Position Fluid Compute for workloads that need serverless elasticity with better efficiency for longer-running or compute-heavy backend tasks.",
    proofPoints: [
      "Fluid Compute helps serverless workloads run more efficiently when requests are longer or bursty",
      "Teams keep serverless ergonomics without over-provisioning infrastructure",
      "Useful for AI, data, and backend tasks that do not fit simple short-lived functions",
    ],
    signals: ["backend/API scaling roles", "AI or data workloads", "serverless, queue, or worker architecture mentions", "cost or cold-start sensitivity"],
  },
  agents: {
    label: "Agents",
    description: "Position Vercel as an execution and deployment layer for agentic products, agent workflows, and AI-native user experiences.",
    proofPoints: [
      "Vercel helps teams ship AI-native frontends and agent experiences quickly",
      "Strong Next.js and AI SDK ecosystem support agent workflows from prototype to production",
      "Integrated infrastructure lets product teams iterate on agent UX without platform drag",
    ],
    signals: ["agent product announcements", "AI workflow or automation hiring", "AI SDK, LangChain, orchestration, or tool-calling mentions", "founder posts about AI-native product strategy"],
  },
};

function getCampaignContext(input: ContactInput) {
  const offerKey = input.campaign_offer || "infra";
  const offer = OFFER_CONTEXT[offerKey] || OFFER_CONTEXT.infra;
  const persona = input.campaign_persona || "technical_leader";
  return {
    persona,
    offerKey,
    offer,
    text: `Selected persona: ${persona.replace(/_/g, " ")}
Selected offer: ${offer.label}
Offer positioning: ${offer.description}
Most useful signals for this offer:
${offer.signals.map((signal) => `- ${signal}`).join("\n")}
Proof points to prefer when relevant:
${offer.proofPoints.map((point) => `- ${point}`).join("\n")}`,
  };
}

export function buildStage1Prompt(input: ContactInput): string {
  const { first_name, last_name, company_name, website, title } = input;
  const fullName = `${first_name} ${last_name}`.trim();
  const campaign = getCampaignContext(input);

  return `You are a senior GTM researcher at Vercel on the EMEA Startups team.
Your job is to find deployment infrastructure and frontend engineering signals for a startup prospect.
You are preparing personalised outreach for ${fullName}, ${title} at ${company_name} (${website}).

Campaign context:
${campaign.text}

Vercel's core value proposition for startups:
- Instant preview deployments on every git push
- Edge Network: serve from 100+ regions, sub-50ms TTFB globally
- Native Next.js support with zero config and instant builds
- Eliminates the need for a dedicated DevOps/infra hire at seed/Series A stage
- Competitors we displace: Netlify, AWS Amplify, self-hosted infra, Railway, Render, Heroku
- AI Gateway for model routing, observability, cost control, and provider flexibility
- Fluid Compute for longer-running, bursty, or AI-adjacent serverless workloads
- Agent-focused workflows for teams building AI-native products and agent experiences

Run FIVE separate web searches in this exact order:

SEARCH 1 - TECH STACK & FRAMEWORK SIGNALS
Query: "${company_name} tech stack frontend framework Next.js React"
What to find: Do they use Next.js, React, or another modern framework? Any blog posts, job specs, or GitHub activity revealing their frontend stack? Are they self-hosting or on a competitor platform?

SEARCH 2 - DEPLOY & INFRA JOB SIGNALS
Query: "${company_name} hiring frontend engineer DevOps platform engineer site reliability"
What to find: Are they hiring for infra or frontend roles? Job descriptions mentioning CI/CD, deployment pipelines, preview environments, or build tooling are strong signals they're feeling deploy pain.

SEARCH 3 - GROWTH & FUNDING SIGNALS
Query: "${company_name} funding round Series A B seed 2024 2025"
What to find: Recent funding rounds, headcount growth, or market expansion. A funded startup is actively scaling and infra becomes a bottleneck.

SEARCH 4 - FOUNDER/DECISION MAKER PUBLIC VOICE
Query: "${fullName} ${company_name} engineering infrastructure developer experience"
What to find: Has ${fullName} written or spoken about engineering velocity, developer tooling, scaling their team, infrastructure, AI product strategy, or agent workflows?

SEARCH 5 - PERFORMANCE & SCALE PAIN
Query: "${company_name} web performance page speed scaling frontend users"
What to find: Any evidence of performance complaints, slow load times, user-facing issues, international expansion, or engineering posts about scaling challenges.

After the mandated searches, interpret every signal through the selected offer (${campaign.offer.label}). Prefer signals that make that offer timely and commercially relevant.

Return a single JSON object only:

{
  "confidence": "high" | "medium" | "low",
  "confidence_reasoning": "one sentence explaining why",
  "strongest_signal": "tech_stack" | "deploy_hiring" | "funding_growth" | "founder_voice" | "performance_pain",
  "signals": {
    "tech_stack": { "found": true | false, "framework": "Next.js" | "React" | "Vue" | "other" | "unknown", "current_platform": "self-hosted" | "Netlify" | "AWS Amplify" | "Railway" | "Render" | "Heroku" | "unknown", "summary": "one sentence", "source_url": "url or empty string" },
    "deploy_hiring": { "found": true | false, "role_title": "exact job title if found or empty string", "revealing_jd_line": "most relevant line or empty string", "summary": "one sentence", "source_url": "url or empty string" },
    "funding_growth": { "found": true | false, "round": "Series A" | "Series B" | "Seed" | "other" | "unknown", "amount": "e.g. $12M or unknown", "date": "e.g. March 2025 or unknown", "summary": "one sentence", "source_url": "url or empty string" },
    "founder_voice": { "found": true | false, "quote_or_topic": "direct quote or topic, or empty string", "platform": "LinkedIn" | "blog" | "podcast" | "conference" | "Twitter/X" | "other" | "unknown", "summary": "one sentence", "source_url": "url or empty string" },
    "performance_pain": { "found": true | false, "inferred_platform": "where they're likely hosted if known or empty string", "summary": "one sentence", "source_url": "url or empty string" }
  }
}

Confidence scoring rules:
- HIGH: 2+ strong signals found.
- MEDIUM: 1 strong signal found, or 2+ weak signals.
- LOW: Minimal public information.

Return ONLY the JSON object. No markdown fences. No commentary.`;
}

export function buildStage2Prompt(stage1: any, input: ContactInput): string {
  const campaign = getCampaignContext(input);

  return `You are a senior AE at Vercel on the EMEA Startups team. You are reviewing research on a startup prospect.

Here is the research:
${JSON.stringify(stage1, null, 2)}

Campaign context:
${campaign.text}

Your job: identify the single sharpest outreach narrative for this prospect.

Vercel's core messages for startups:
1. You shouldn't need a DevOps hire at seed/Series A.
2. Every engineer should be able to ship without a deployment ticket.
3. International expansion creates latency pressure.
4. Teams outgrow Netlify, Amplify, Railway, Render, Heroku, or self-hosted frontend infra.
5. Preview environments remove deployment friction.
6. AI Gateway gives AI teams model routing, observability, and cost control.
7. Fluid Compute keeps serverless ergonomics for longer-running and bursty workloads.
8. Teams building agents need fast iteration loops across UX, tool calls, and production infrastructure.

Rules:
- Pick the SINGLE strongest narrative.
- Ground it in at least one specific signal from the research.
- Favor the selected offer (${campaign.offer.label}) unless the research clearly shows a better Vercel angle.
- If confidence is LOW and no meaningful signals were found, set send_recommendation to SKIP.
- Keep narrative under 20 words.

Return ONLY this JSON object:
{
  "narrative": "under 20 words",
  "tension": "one sentence",
  "primary_signal_used": "which signal from stage1 drove this narrative",
  "send_recommendation": "SEND" | "SKIP",
  "skip_reason": "if SKIP, one sentence on why - otherwise empty string"
}`;
}

export function buildEmailPrompt(input: ContactInput, stage2: any, stage1: any): string {
  const { first_name, company_name, title } = input;
  const campaign = getCampaignContext(input);

  return `You are a senior AE at Vercel on the EMEA Startups team. Write a cold email to ${first_name}, ${title} at ${company_name}.

Research narrative: ${stage2.narrative}
Core tension: ${stage2.tension}
Strongest signal: ${JSON.stringify(stage1.signals[stage1.strongest_signal])}
Campaign context:
${campaign.text}

Vercel proof points, use ONE:
- Preview deployments: every PR gets a live URL.
- Edge Network: 100+ regions and low latency globally.
- Zero-config Next.js: engineers ship instead of maintaining build plumbing.
${campaign.offer.proofPoints.map((point) => `- ${point}`).join("\n")}

Email rules:
- 50-80 words total.
- Subject line: 4-7 words. No "quick question".
- First line: specific observation about ${company_name}.
- Prefer ${campaign.offer.label} if the evidence supports it.
- One soft question CTA.
- No bullets in the final email.
- Mention AI only when the selected offer or source evidence is AI Gateway, Fluid Compute, or Agents.

Return ONLY this JSON object:
{
  "subject_line": "4-7 word subject",
  "first_line": "opening sentence",
  "body": "full email body including first line, 50-80 words",
  "word_count": number,
  "cta": "closing question"
}`;
}

export function buildLinkedInPrompt(input: ContactInput, stage2: any, stage1: any): string {
  const { first_name, company_name, title } = input;
  const campaign = getCampaignContext(input);

  return `Write a LinkedIn connection request note to ${first_name}, ${title} at ${company_name}.

Research narrative: ${stage2.narrative}
Strongest signal: ${JSON.stringify(stage1.signals[stage1.strongest_signal])}
Campaign context:
${campaign.text}

Rules:
- HARD LIMIT: 300 characters.
- No pitch. Do not mention Vercel by name.
- Reference one specific thing from the research.
- Bias toward ${campaign.offer.label} only when it sounds natural.

Return ONLY this JSON object:
{
  "connection_note": "the full note - max 300 characters",
  "character_count": number
}`;
}

export function buildColdCallPrompt(input: ContactInput, stage2: any, stage1: any): string {
  const { first_name, company_name, title } = input;
  const campaign = getCampaignContext(input);

  const peerCategories: Record<string, string> = {
    tech_stack: "startups that recently migrated to Next.js",
    deploy_hiring: "startups hiring their first DevOps or platform engineer",
    funding_growth: "Series A/B startups scaling their engineering team",
    founder_voice: "engineering leaders focused on developer velocity",
    performance_pain: "startups expanding into new markets and hitting latency issues",
  };
  const peerCategory = peerCategories[stage1.strongest_signal] || "high-growth startups";

  return `Write a cold call opener for ${first_name}, ${title} at ${company_name}.

Research narrative: ${stage2.narrative}
Core tension: ${stage2.tension}
Peer category: ${peerCategory}
Strongest signal: ${JSON.stringify(stage1.signals[stage1.strongest_signal])}
Campaign context:
${campaign.text}

Rules:
- 60-90 spoken words.
- Permission-based opener.
- One concrete reason tied to research.
- Connect to ${campaign.offer.label} if the evidence supports it.
- End with a question.

Return ONLY this JSON object:
{
  "peer_category": "${peerCategory}",
  "reason_for_call": "one sentence",
  "full_script": "complete spoken script",
  "closing_question": "final question"
}`;
}
