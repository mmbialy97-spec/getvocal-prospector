# GetVocal Prospector

AI-powered prospect research and personalization pipeline. Upload a CSV of contacts, get back personalized email openers, LinkedIn notes, and cold call scripts grounded in real-time web research and evidence-backed outbound frameworks.

## What it does

For each contact in your CSV, the tool runs a **three-stage pipeline**:

1. **Research** — Claude runs 5 mandated web searches per company (reviews, hiring, growth, decision maker voice, support stack), then synthesizes the findings with confidence scoring.
2. **Synthesis** — Picks the single strongest narrative thread from the research. Skips contacts with insufficient signal.
3. **Channel generation** — Three parallel Claude calls, each with its own evidence-backed prompt:
   - **Email** — 50-80 words, structure based on Instantly 2026 (100M+ emails) data
   - **LinkedIn** — 300 char max, pattern from Belkins 2025 (20M LinkedIn attempts)
   - **Cold call** — "Heard the name tossed around" opener from Gong Labs (300M+ calls, 11.24% success rate)

Results persist in the browser via **IndexedDB** — close the tab, come back tomorrow, your runs are still there. Exportable as CSV for import into Lemlist, HubSpot, or any outbound tool.

## Stack

- **Next.js 14** (App Router) deployed on **Vercel**
- **IndexedDB** for local persistence (no database to set up)
- **Claude Sonnet 4.5** with web search tool
- **PapaParse** for CSV handling

## Setup (5 minutes)

### 1. Install

```bash
npm install
```

### 2. Environment variable

Copy `.env.local.example` to `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Get your key from [console.anthropic.com](https://console.anthropic.com).

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Deploy to Vercel

```bash
# Push to GitHub, then:
# 1. Go to vercel.com, import the repo
# 2. Add ANTHROPIC_API_KEY in Project Settings → Environment Variables
# 3. Deploy
```

**Important:** On the Vercel **Hobby** tier, serverless functions time out at 60s. Each contact takes ~30-45s to process. If processing times out, upgrade to **Pro** (300s timeout). The code sets `maxDuration = 300` on the process route.

## CSV format

Required columns (headers are case-insensitive and flexible):

| Column | Example | Aliases accepted |
|---|---|---|
| `first_name` | Sarah | `firstname`, `fname` |
| `last_name` | Chen | `lastname`, `lname` |
| `company_name` | Chime | `company`, `account`, `account_name` |
| `website` | chime.com | `domain`, `url` |
| `title` | VP Customer Experience | `job_title`, `position` |
| `linkedin_url` | linkedin.com/in/sarahchen | `linkedin`, `li_url` |

## About local persistence

All your runs and results are stored in the browser's **IndexedDB**. This means:

- ✅ No database setup
- ✅ Results persist across page refreshes and tab closes
- ✅ You can browse past runs from the run history at the top
- ✅ Private by default — data never leaves your browser
- ⚠️ Data is tied to the browser and device — clearing browser data deletes runs
- ⚠️ Not shareable between users — each person has their own local history

If you want to convert to a proper shared database later (Supabase, Postgres, etc.), the schema is simple: two tables (`runs`, `contacts`), JSON columns for stage outputs. Fork the project and add a Supabase client — takes about an hour.

## Architecture notes

### Why three stages, not one big prompt

Narrow prompts produce better output. Stage 1 is focused purely on retrieval and signal detection. Stage 2 is focused purely on narrative selection. Each Stage 3 channel has its own constraints and anti-patterns (forbidden words, length caps, structural rules). No bleed between channels means no average output.

### Why process one contact per API call

Vercel serverless functions have hard timeout limits (60s hobby, 300s pro). Processing 20 contacts in one call would time out. The client calls `/api/process` once per contact in sequence, shows live progress, and stores each result to IndexedDB as it completes.

### Confidence scoring is honest

- **HIGH**: 2+ specific signals, at least one under 90 days old, verifiable source URL
- **MEDIUM**: 1 useful signal found, or signals are older than 90 days
- **LOW / SKIP**: Only generic company info — flag for manual research

Sending low-signal outreach at scale trains prospects to ignore you. The tool will tell you when not to send.

## Evidence base

The prompt constraints are grounded in published research:

- **Cold email**: [Instantly 2026 Benchmark Report](https://instantly.ai/cold-email-benchmark-report-2026) (100M+ emails), Landbase, 30MPC, Sendspark
- **LinkedIn**: [Belkins 2025 Study](https://belkins.io/blog/linkedin-outreach-study) (20M outreach attempts), Expandi, Skylead
- **Cold call**: [Gong Labs analysis of 300M+ calls](https://www.gong.io/blog/the-best-and-worst-cold-call-openers-backed-by-data-from-300m-calls)

## Cost

Per contact, approximately:
- 1 × Claude Sonnet 4.5 call with web search (Stage 1) — ~$0.03
- 1 × Claude Sonnet 4.5 call (Stage 2) — ~$0.005
- 3 × Claude Sonnet 4.5 calls parallel (Stage 3) — ~$0.015

**Total: ~$0.05 per contact.** 100 contacts = ~$5. 1000 contacts = ~$50.

## File structure

```
getvocal-prospector/
├── app/
│   ├── api/process/route.ts      # POST /api/process — process one contact
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                  # main UI
├── lib/
│   ├── claude.ts                 # Anthropic SDK wrapper + JSON parsing
│   ├── prompts.ts                # THE IP — all 5 stage prompts
│   └── storage.ts                # IndexedDB persistence layer
├── .env.local.example
├── package.json
└── README.md
```

## Troubleshooting

**"Stage 1 failed" errors**: Usually Claude couldn't parse JSON from the response or web search returned nothing. Check the browser console for full error. Retry the run.

**Vercel timeout**: Upgrade to Pro. Or reduce batch size to <10 contacts at a time.

**"No JSON found" errors**: Claude occasionally wraps JSON in markdown or adds preamble. The parser handles most cases. If it persists, the prompt may need tuning for that specific company type.

**Low confidence on every contact**: Web search isn't finding signals. Check that your contacts have real companies with web presence. Private companies or early-stage startups may genuinely have no public signals.

**Lost my data**: IndexedDB data is per-browser-per-device. If you cleared cookies/site data, results are gone. Download CSVs after each run as a backup.
