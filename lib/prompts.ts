// lib/prompts.ts
// Vercel EMEA Startups GTM Prospector
// Persona: Startup CEOs, CTOs, VP Engs, Heads of Platform
// Pain: deploy velocity, DX friction, infra cost, Edge performance, scaling frontend infra
// Vercel value: faster deploys, preview environments, Edge Network, Next.js-native DX

export type ContactInput = {
  first_name: string;
  last_name: string;
  company_name: string;
  website: string;
  title: string;
  linkedin_url: string;
};

// ─── Stage 1: Research ────────────────────────────────────────────────────
// 5 targeted web searches per company.
// Each search hunts for a specific deploy/infra signal relevant to Vercel's ICP.

export function buildStage1Prompt(input: ContactInput): string {
  const { first_name, last_name, company_name, website, title } = input;
  const fullName = `${first_name} ${last_name}`.trim();

  return `You are a senior GTM researcher at Vercel on the EMEA Startups team.
Your job is to find deployment infrastructure and frontend engineering signals for a startup prospect.
You are preparing personalised outreach for ${fullName}, ${title} at ${company_name} (${website}).

Vercel's core value proposition for startups:
- Instant preview deployments on every git push (kills the "works on my machine" problem)
- Edge Network: serve from 100+ regions, sub-50ms TTFB globally
- Native Next.js support — zero config, instant builds
- Eliminates the need for a dedicated DevOps/infra hire at seed/Series A stage
- Competitors we displace: Netlify, AWS Amplify, self-hosted infra (k8s/ECS), Railway, Render, Heroku

Run FIVE separate web searches in this exact order:

SEARCH 1 — TECH STACK & FRAMEWORK SIGNALS
Query: "${company_name} tech stack frontend framework Next.js React"
What to find: Do they use Next.js, React, or another modern framework? Any blog posts, job specs, or GitHub activity revealing their frontend stack? Are they self-hosting or on a competitor platform?

SEARCH 2 — DEPLOY & INFRA JOB SIGNALS
Query: "${company_name} hiring frontend engineer DevOps platform engineer site reliability"
What to find: Are they hiring for infra or frontend roles? Job descriptions mentioning CI/CD, deployment pipelines, preview environments, or build tooling are strong signals they're feeling deploy pain. A startup hiring a DevOps engineer is a company Vercel can save.

SEARCH 3 — GROWTH & FUNDING SIGNALS
Query: "${company_name} funding round Series A B seed 2024 2025"
What to find: Recent funding rounds (last 18 months), headcount growth, new market expansions. A recently funded startup is actively scaling — deploy infrastructure becomes a bottleneck at this stage.

SEARCH 4 — FOUNDER/DECISION MAKER PUBLIC VOICE
Query: "${fullName} ${company_name} engineering infrastructure developer experience"
What to find: Has ${fullName} written or spoken about engineering velocity, developer tooling, scaling their team, or infrastructure? LinkedIn posts, podcast appearances, blog posts, or conference talks. A quote or topic they've publicly engaged with is the strongest personalisation signal.

SEARCH 5 — PERFORMANCE & SCALE PAIN
Query: "${company_name} web performance page speed scaling frontend users"
What to find: Any evidence of performance complaints, slow load times, user-facing issues, international expansion (which creates latency problems), or engineering blog posts about scaling challenges. Vercel's Edge Network directly solves global latency for startups expanding internationally.

After completing all five searches, return a single JSON object — no markdown, no preamble:

{
  "confidence": "high" | "medium" | "low",
  "confidence_reasoning": "one sentence explaining why",
  "strongest_signal": "tech_stack" | "deploy_hiring" | "funding_growth" | "founder_voice" | "performance_pain",
  "signals": {
    "tech_stack": {
      "found": true | false,
      "framework": "Next.js" | "React" | "Vue" | "other" | "unknown",
      "current_platform": "self-hosted" | "Netlify" | "AWS Amplify" | "Railway" | "Render" | "Heroku" | "unknown",
      "summary": "one sentence of what you found",
      "source_url": "url or empty string"
    },
    "deploy_hiring": {
      "found": true | false,
      "role_title": "exact job title if found or empty string",
      "revealing_jd_line": "most relevant line from the job description or empty string",
      "summary": "one sentence",
      "source_url": "url or empty string"
    },
    "funding_growth": {
      "found": true | false,
      "round": "Series A" | "Series B" | "Seed" | "other" | "unknown",
      "amount": "e.g. $12M or unknown",
      "date": "e.g. March 2025 or unknown",
      "summary": "one sentence on growth stage and what it means for infra needs",
      "source_url": "url or empty string"
    },
    "founder_voice": {
      "found": true | false,
      "quote_or_topic": "direct quote or topic they've engaged with publicly, or empty string",
      "platform": "LinkedIn" | "blog" | "podcast" | "conference" | "Twitter/X" | "other" | "unknown",
      "summary": "one sentence",
      "source_url": "url or empty string"
    },
    "performance_pain": {
      "found": true | false,
      "inferred_platform": "where they're likely hosted if known or empty string",
      "summary": "one sentence — specific pain found or inferred latency risk",
      "source_url": "url or empty string"
    }
  }
}

Confidence scoring rules:
- HIGH: 2+ strong signals found. Strong = framework confirmed as Next.js/React, OR infra job post found, OR founder has publicly discussed engineering velocity, OR funded in last 12 months with clear growth trajectory.
- MEDIUM: 1 strong signal found, or 2+ weak signals (inferred rather than confirmed).
- LOW: Minimal public information. No tech stack confirmed, no relevant job posts, no recent funding found.

Return ONLY the JSON object. No markdown fences. No commentary.`;
}

// ─── Stage 2: Synthesis ───────────────────────────────────────────────────
// Takes Stage 1 output and distils the single strongest outreach narrative.

export function buildStage2Prompt(stage1: any): string {
  return `You are a senior AE at Vercel on the EMEA Startups team. You are reviewing research on a startup prospect.

Here is the research:
${JSON.stringify(stage1, null, 2)}

Your job: identify the single sharpest outreach narrative for this prospect — the one tension or opportunity that makes Vercel obviously relevant right now.

Vercel's core messages for startups:
1. "You shouldn't need a DevOps hire at seed/Series A — Vercel eliminates that headcount."
2. "Every engineer on your team should be able to ship to production without a deployment ticket."
3. "You're expanding internationally — your current setup is adding 300ms+ of latency for every user outside your primary region."
4. "You're on Netlify/Amplify/Railway — you've already outgrown it, you just haven't hit the wall yet."
5. "Your deploy pipeline is a tax on your engineering velocity — preview environments change that."

Rules:
- Pick the SINGLE strongest narrative. Don't hedge with multiple angles.
- The narrative must be grounded in at least one specific signal from the research.
- If confidence is LOW and no meaningful signals were found, set send_recommendation to SKIP.
- Keep the narrative under 20 words — it is a hook, not an explanation.
- The tension is the specific problem. Be brutal and specific.

Return ONLY this JSON object — no markdown, no preamble:

{
  "narrative": "under 20 words — the core hook, present tense, specific to this company",
  "tension": "one sentence — the specific problem this company has that Vercel solves",
  "primary_signal_used": "which signal from stage1 drove this narrative",
  "send_recommendation": "SEND" | "SKIP",
  "skip_reason": "if SKIP, one sentence on why — otherwise empty string"
}`;
}

// ─── Stage 3a: Cold Email ─────────────────────────────────────────────────
// 50-80 words. Subject line curiosity gap. One specific signal. One CTA.
// Grounded in Instantly 2026 research: shorter = higher reply rate.

export function buildEmailPrompt(input: ContactInput, stage2: any, stage1: any): string {
  const { first_name, company_name, title } = input;

  return `You are a senior AE at Vercel on the EMEA Startups team. Write a cold email to ${first_name}, ${title} at ${company_name}.

Research narrative: ${stage2.narrative}
Core tension: ${stage2.tension}
Strongest signal: ${JSON.stringify(stage1.signals[stage1.strongest_signal])}

Vercel's proof points for startups (use ONE, the most relevant):
- Startups on Vercel ship 2x faster than on self-hosted infra — fewer deployment incidents, no DevOps bottleneck
- Preview deployments: every PR gets a live URL — design, product, and eng review before it merges
- Edge Network: 100+ regions, sub-50ms TTFB — critical for startups expanding to new markets
- Zero-config Next.js: no webpack, no CI/CD plumbing — engineers ship, not configure
- Vercel is trusted by Loom, HashiCorp, Robinhood, and 700,000+ startups globally

Email rules (from Instantly 2026 research — 100M+ emails analysed):
- 50-80 words total in the body. No exceptions. Shorter = higher reply rate.
- Subject line: 4-7 words. Curiosity gap or specific hook. No "quick question". No emoji.
- First line: specific observation about ${company_name} — NOT a compliment, NOT "I came across your company"
- One Vercel proof point maximum — the most relevant one
- CTA: one soft question. Not "book a call". Something they can answer in one sentence.
- No bullet points. Flowing prose only.
- Tone: peer-to-peer. You are a fellow operator, not a vendor.
- Never mention "AI" or "machine learning" — Vercel is infrastructure, not AI tooling.

Return ONLY this JSON object — no markdown, no preamble:

{
  "subject_line": "4-7 word subject",
  "first_line": "opening sentence — specific observation, no compliment",
  "body": "full email body including first line, 50-80 words, no subject line",
  "word_count": number,
  "cta": "the closing question extracted from the body"
}`;
}

// ─── Stage 3b: LinkedIn Note ──────────────────────────────────────────────
// 300 chars max. Warm, peer-to-peer. One hook. No pitch.
// Grounded in Belkins 2025: notes under 300 chars get 3x higher acceptance.

export function buildLinkedInPrompt(input: ContactInput, stage2: any, stage1: any): string {
  const { first_name, company_name, title } = input;

  return `You are a senior AE at Vercel on the EMEA Startups team. Write a LinkedIn connection request note to ${first_name}, ${title} at ${company_name}.

Research narrative: ${stage2.narrative}
Strongest signal: ${JSON.stringify(stage1.signals[stage1.strongest_signal])}

LinkedIn note rules (from Belkins 2025 — 20M LinkedIn outreach attempts):
- HARD LIMIT: 300 characters including spaces. Count carefully.
- No pitch. No "I'd love to connect". No "I came across your profile".
- Reference one specific, real thing about ${company_name} or ${first_name} from the research.
- End with one soft question or observation — not a CTA to book a call.
- Tone: curious and warm. Like a smart operator reaching out to a peer.
- Do NOT mention Vercel by name. The goal is connection acceptance, not a pitch.

Return ONLY this JSON object — no markdown, no preamble:

{
  "connection_note": "the full note — max 300 characters",
  "character_count": number
}`;
}

// ─── Stage 3c: Cold Call Opener ───────────────────────────────────────────
// Gong-backed structure: permission-based opener + one specific reason + one question.
// Grounded in Gong Labs (300M+ calls): calls that state a reason for calling
// have 2.1x higher connect-to-meeting conversion.

export function buildColdCallPrompt(input: ContactInput, stage2: any, stage1: any): string {
  const { first_name, company_name, title } = input;

  const peerCategories: Record<string, string> = {
    tech_stack: "startups that recently migrated to Next.js",
    deploy_hiring: "startups hiring their first DevOps or platform engineer",
    funding_growth: "Series A/B startups scaling their engineering team",
    founder_voice: "engineering leaders focused on developer velocity",
    performance_pain: "startups expanding into new markets and hitting latency issues",
  };

  const peerCategory = peerCategories[stage1.strongest_signal] || "high-growth startups";

  return `You are a senior AE at Vercel on the EMEA Startups team. Write a cold call opener for ${first_name}, ${title} at ${company_name}.

Research narrative: ${stage2.narrative}
Core tension: ${stage2.tension}
Peer category for this call: ${peerCategory}
Strongest signal: ${JSON.stringify(stage1.signals[stage1.strongest_signal])}

Cold call structure (Gong Labs — 300M+ calls analysed):
Use the "Heard the name tossed around" permission-based opener structure:
1. Intro: name + company, immediate permission ask ("Did I catch you at a bad time?")
2. Reason for call: ONE specific, concrete reason tied to the research signal
3. Peer reference: briefly mention a similar startup category you work with (use: ${peerCategory})
4. Single question: open-ended, focused on their current pain — designed to get them talking

Rules:
- Total script: 60-90 words when spoken aloud
- No features list. No "we help companies like yours". No buzzwords.
- The reason for call must reference something specific about ${company_name} — not a generic pitch.
- End on a question, not a statement.
- Write it as a natural spoken script — contractions, breathing room, human pacing.

Return ONLY this JSON object — no markdown, no preamble:

{
  "peer_category": "${peerCategory}",
  "reason_for_call": "one sentence — the specific reason tied to research",
  "full_script": "the complete spoken script, 60-90 words",
  "closing_question": "the final question extracted from the script"
}`;
}
