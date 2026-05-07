"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Papa from "papaparse";
import {
  StoredContact,
  StoredRun,
  createRun,
  updateRunStatus,
  addContacts,
  updateContact,
  listRuns,
  getContactsForRun,
  deleteRun,
} from "@/lib/storage";

// ─── Types ────────────────────────────────────────────────────────────────
type ContactInput = {
  first_name: string;
  last_name: string;
  company_name: string;
  website: string;
  title: string;
  linkedin_url: string;
};

type ProgressRow = {
  name: string;
  company: string;
  status: "pending" | "processing" | "done" | "skipped" | "error";
  step: string;
};

const PROCESSING_STEPS = [
  "Searching reviews...",
  "Searching hiring signals...",
  "Searching growth signals...",
  "Searching decision maker...",
  "Searching support stack...",
  "Synthesising narrative...",
  "Generating channels...",
];

// ─── CSV helpers ──────────────────────────────────────────────────────────
function normalizeRow(raw: any): ContactInput {
  const normalized: any = {};
  for (const key of Object.keys(raw)) {
    const normalKey = key
      .toLowerCase()
      .trim()
      .replace(/[\s\-]+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
    normalized[normalKey] = (raw[key] || "").toString().trim();
  }
  return {
    first_name: normalized.first_name || normalized.firstname || normalized.fname || "",
    last_name: normalized.last_name || normalized.lastname || normalized.lname || "",
    company_name: normalized.company_name || normalized.company || normalized.account || normalized.account_name || "",
    website: normalized.website || normalized.domain || normalized.url || "",
    title: normalized.title || normalized.job_title || normalized.position || "",
    linkedin_url: normalized.linkedin_url || normalized.linkedin || normalized.li_url || "",
  };
}

function downloadResultsCSV(contacts: StoredContact[]) {
  const headers = [
    "first_name","last_name","company_name","title","linkedin_url",
    "confidence","narrative","tension","email_subject","email_body",
    "email_first_line","email_word_count","linkedin_note","linkedin_char_count",
    "cold_call_peer_category","cold_call_script","cold_call_reason",
    "strongest_signal","signal_source_url","status","error_message",
  ];
  const rows = contacts.map((c) => {
    const s1 = c.stage1 || {};
    const s2 = c.stage2 || {};
    const email = c.email || {};
    const li = c.linkedin || {};
    const cc = c.coldcall || {};
    const sig = s1.signals?.[s1.strongest_signal] || {};
    return [
      c.first_name, c.last_name, c.company_name, c.title, c.linkedin_url,
      s1.confidence || "", s2.narrative || "", s2.tension || "",
      email.subject_line || "", (email.body || "").replace(/\n/g, " "),
      email.first_line || "", email.word_count || "",
      li.connection_note || "", li.character_count || "",
      cc.peer_category || "", (cc.full_script || "").replace(/\n/g, " "),
      cc.reason_for_call || "", s1.strongest_signal || "",
      sig.source_url || "", c.status, c.error_message || "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
  });
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vercel-gtm-prospector-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Copy button ──────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button className={`copy-btn ${copied ? "copied" : ""}`} onClick={copy}>
      {copied ? "✓ copied" : "copy"}
    </button>
  );
}

// ─── Vercel Triangle SVG ──────────────────────────────────────────────────
function VercelTriangle({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size * (65 / 76)} viewBox="0 0 76 65" fill={color} aria-hidden="true">
      <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
    </svg>
  );
}

// ─── Deployment status badge ──────────────────────────────────────────────
function DeployBadge({ status }: { status: "ready" | "building" | "error" }) {
  const colors: Record<string, string> = {
    ready: "var(--v-success)",
    building: "var(--v-warning)",
    error: "var(--v-error)",
  };
  const labels: Record<string, string> = {
    ready: "Ready",
    building: "Building",
    error: "Error",
  };
  return (
    <span className="deploy-badge">
      <span className="deploy-dot" style={{ background: colors[status] }} />
      {labels[status]}
    </span>
  );
}

// ─── Runtime tag ─────────────────────────────────────────────────────────
function RuntimeTag({ label }: { label: string }) {
  return <span className="runtime-tag">{label}</span>;
}

// ─── Contact card ─────────────────────────────────────────────────────────
function ContactCard({ contact }: { contact: StoredContact }) {
  const [open, setOpen] = useState(false);
  const { stage1, stage2, email, linkedin, coldcall } = contact;
  const conf = stage1?.confidence || "low";
  const isSkip = contact.status === "skipped" || stage2?.send_recommendation === "SKIP" || (!stage2?.narrative && contact.status === "done");
  const isError = contact.status === "error";
  const isPending = contact.status === "pending" || contact.status === "processing";

  const badgeClass = isError ? "skip" : isSkip ? "skip" : isPending ? "skip" : conf;
  const badgeLabel = isError ? "ERROR" : isSkip ? "SKIP" : isPending ? "..." : conf.toUpperCase();

  return (
    <div className={`contact-card ${isSkip || isError ? "skipped" : ""}`}>
      <div className="card-header" onClick={() => setOpen((o) => !o)}>
        <div className="card-left">
          <span className={`confidence-badge ${badgeClass}`}>{badgeLabel}</span>
          <div style={{ minWidth: 0 }}>
            <div className="card-name">
              {contact.first_name} {contact.last_name}
            </div>
            <div className="card-company">
              {contact.title} · {contact.company_name}
            </div>
          </div>
          {stage2?.narrative && (
            <div className="card-narrative">"{stage2.narrative}"</div>
          )}
        </div>
        <div className="card-right">
          <span className={`chevron ${open ? "open" : ""}`}>▾</span>
        </div>
      </div>

      {open && (
        <div className="card-body">
          {isError ? (
            <div className="skip-msg">⚠ {contact.error_message || "Processing error"}</div>
          ) : isSkip ? (
            <div className="skip-msg">⚠ Insufficient signal — manual research required before sending.</div>
          ) : isPending ? (
            <div className="skip-msg">Still processing...</div>
          ) : (
            <>
              <div className="channel-block full-width">
                <div className="channel-label">
                  <span className="channel-name signal">◆ SIGNAL FOUND</span>
                  <span className="channel-meta">strongest: {stage1?.strongest_signal || "—"}</span>
                </div>
                <div className="channel-content">
                  {stage1?.signals &&
                    Object.entries(stage1.signals).map(([k, v]: [string, any]) =>
                      v?.found || v?.inferred_platform ? (
                        <div className="signal-item" key={k}>
                          <span className="signal-key">{k.replace(/_/g, " ")}</span>
                          <span className="signal-val">
                            {v.summary || v.event || v.quote_or_topic || v.revealing_jd_line || v.inferred_platform || "—"}
                            {v.source_url && (
                              <a href={v.source_url} target="_blank" rel="noreferrer"> source ↗</a>
                            )}
                          </span>
                        </div>
                      ) : null
                    )}
                  {stage1?.confidence_reasoning && (
                    <div className="signal-item">
                      <span className="signal-key">reasoning</span>
                      <span className="signal-val" style={{ fontStyle: "italic", color: "var(--v-gray-500)" }}>
                        {stage1.confidence_reasoning}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {email && (
                <div className="channel-block full-width">
                  <div className="channel-label">
                    <span className="channel-name email">✉ EMAIL</span>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span className="word-count">{email.word_count}w</span>
                      <CopyButton text={`Subject: ${email.subject_line}\n\n${email.body}`} />
                    </div>
                  </div>
                  <div className="channel-content">
                    <span className="subject">{email.subject_line}</span>
                    {email.body}
                  </div>
                </div>
              )}

              {linkedin && (
                <div className="channel-block">
                  <div className="channel-label">
                    <span className="channel-name linkedin">in LINKEDIN</span>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span className={`char-count ${linkedin.character_count <= 300 ? "ok" : "warn"}`}>
                        {linkedin.character_count}/300
                      </span>
                      <CopyButton text={linkedin.connection_note} />
                    </div>
                  </div>
                  <div className="channel-content">{linkedin.connection_note}</div>
                </div>
              )}

              {coldcall && (
                <div className="channel-block">
                  <div className="channel-label">
                    <span className="channel-name coldcall">☎ COLD CALL</span>
                    <CopyButton text={coldcall.full_script} />
                  </div>
                  <div className="channel-content">{coldcall.full_script}</div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Run history sidebar ──────────────────────────────────────────────────
function RunHistory({
  runs, currentRunId, onSelect, onDelete, onNew,
}: {
  runs: StoredRun[];
  currentRunId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  if (runs.length === 0) return null;
  return (
    <div className="history">
      <div className="history-header">
        <span className="history-title">Deployments</span>
        <button className="ghost-btn" onClick={onNew}>+ New run</button>
      </div>
      <div className="history-list">
        {runs.map((r) => (
          <div
            key={r.id}
            className={`history-item ${currentRunId === r.id ? "active" : ""}`}
            onClick={() => onSelect(r.id)}
          >
            <div className="history-item-icon">
              <VercelTriangle size={12} />
            </div>
            <div className="history-item-main">
              <div className="history-item-name">{r.name}</div>
              <div className="history-item-meta">
                {r.total_contacts} contacts · {new Date(r.created_at).toLocaleDateString()}
              </div>
            </div>
            <button
              className="history-delete"
              onClick={(e) => { e.stopPropagation(); if (confirm("Delete this run?")) onDelete(r.id); }}
            >×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────
export default function Home() {
  const [rows, setRows] = useState<ContactInput[]>([]);
  const [fileName, setFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [running, setRunning] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [contacts, setContacts] = useState<StoredContact[]>([]);
  const [runs, setRuns] = useState<StoredRun[]>([]);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listRuns().then(setRuns).catch(console.error);
  }, []);

  const refreshRuns = useCallback(async () => {
    const r = await listRuns();
    setRuns(r);
  }, []);

  const handleFile = useCallback((file: File) => {
    if (!file) return;
    setError("");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const parsed = (result.data as any[])
          .map(normalizeRow)
          .filter((r) => r.company_name || r.first_name);
        if (parsed.length === 0) {
          setError("No valid rows found. CSV needs columns: first_name, last_name, company_name, website, title, linkedin_url");
          return;
        }
        setRows(parsed);
        setFileName(file.name);
        setContacts([]);
        setProgress([]);
        setCurrentRunId(null);
      },
      error: (err) => setError(`CSV parse error: ${err.message}`),
    });
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const updateProgressRow = (idx: number, patch: Partial<ProgressRow>) => {
    setProgress((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const updateContactState = (idx: number, patch: Partial<StoredContact>) => {
    setContacts((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  const runResearch = async () => {
    if (!rows.length) return;
    setRunning(true);
    setError("");

    const initialProgress: ProgressRow[] = rows.map((r) => ({
      name: `${r.first_name} ${r.last_name}`.trim() || r.company_name,
      company: r.company_name,
      status: "pending",
      step: "Waiting...",
    }));
    setProgress(initialProgress);

    try {
      const run = await createRun(fileName || "Untitled", rows.length);
      setCurrentRunId(run.id);
      const storedContacts = await addContacts(run.id, rows);
      setContacts(storedContacts);

      for (let i = 0; i < storedContacts.length; i++) {
        const contact = storedContacts[i];
        if (i > 0) await new Promise((r) => setTimeout(r, 30000));

        updateProgressRow(i, { status: "processing", step: PROCESSING_STEPS[0] });
        updateContactState(i, { status: "processing" });
        await updateContact(contact.id, { status: "processing" });

        const stepInterval = setInterval(() => {
          setProgress((prev) => {
            const current = prev[i];
            if (!current || current.status !== "processing") return prev;
            const currentIdx = PROCESSING_STEPS.indexOf(current.step);
            const nextIdx = Math.min(currentIdx + 1, PROCESSING_STEPS.length - 1);
            return prev.map((p, pi) => (pi === i ? { ...p, step: PROCESSING_STEPS[nextIdx] } : p));
          });
        }, 6000);

        try {
          const res = await fetch("/api/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              first_name: contact.first_name,
              last_name: contact.last_name,
              company_name: contact.company_name,
              website: contact.website,
              title: contact.title,
              linkedin_url: contact.linkedin_url,
            }),
          });
          clearInterval(stepInterval);
          const result = await res.json();
          if (!res.ok) throw new Error(result.message || `HTTP ${res.status}`);

          const patch: Partial<StoredContact> = {
            stage1: result.stage1,
            stage2: result.stage2,
            email: result.email,
            linkedin: result.linkedin,
            coldcall: result.coldcall,
            status: result.status,
            processed_at: new Date().toISOString(),
            processing_time_ms: result.processing_time_ms,
          };
          await updateContact(contact.id, patch);
          updateContactState(i, patch);

          if (result.status === "skipped") {
            updateProgressRow(i, { status: "skipped", step: "Skipped — insufficient signal" });
          } else {
            updateProgressRow(i, { status: "done", step: "Complete" });
          }
        } catch (err: any) {
          clearInterval(stepInterval);
          const errMsg = err.message || "Unknown error";
          await updateContact(contact.id, { status: "error", error_message: errMsg });
          updateContactState(i, { status: "error", error_message: errMsg });
          updateProgressRow(i, { status: "error", step: `Error: ${errMsg.slice(0, 60)}` });
        }
      }

      await updateRunStatus(run.id, "complete");
      await refreshRuns();
    } catch (err: any) {
      setError(err.message || "Unknown error");
    } finally {
      setRunning(false);
    }
  };

  const loadRun = async (runId: string) => {
    setCurrentRunId(runId);
    const runContacts = await getContactsForRun(runId);
    setContacts(runContacts);
    setProgress([]);
    setRows([]);
    setFileName("");
    setError("");
  };

  const handleDeleteRun = async (runId: string) => {
    await deleteRun(runId);
    if (currentRunId === runId) {
      setCurrentRunId(null);
      setContacts([]);
    }
    await refreshRuns();
  };

  const clearAll = () => {
    setRows([]);
    setFileName("");
    setContacts([]);
    setProgress([]);
    setCurrentRunId(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const stats = {
    total: contacts.length,
    high: contacts.filter((c) => c.stage1?.confidence === "high").length,
    medium: contacts.filter((c) => c.stage1?.confidence === "medium").length,
    skipped: contacts.filter((c) => c.status === "skipped" || c.stage2?.send_recommendation === "SKIP").length,
  };

  const progressPct =
    progress.length === 0
      ? 0
      : (progress.filter((p) => ["done", "skipped", "error"].includes(p.status)).length / progress.length) * 100;

  const hasResults = contacts.length > 0;

  return (
    <div className="app">

      {/* ── Vercel-style topnav ─────────────────────────────────────── */}
      <nav className="topnav">
        <div className="topnav-left">
          <a className="topnav-brand" href="/">
            <VercelTriangle size={18} />
            <span>Vercel</span>
          </a>
          <span className="topnav-divider" />
          <span className="topnav-project">GTM Prospector</span>
          <DeployBadge status={running ? "building" : "ready"} />
        </div>
        <div className="topnav-right">
          <RuntimeTag label="Edge Runtime" />
          <RuntimeTag label="claude-sonnet-4" />
          <RuntimeTag label="Next.js 15" />
        </div>
      </nav>

      {/* ── Pipeline breadcrumb strip ───────────────────────────────── */}
      <div className="pipeline-strip">
        {["CSV Ingest", "Web Search ×5", "Synthesis", "3-Channel Gen", "KV Persist"].map((step, i) => (
          <div className="pipeline-step" key={step}>
            <span className="pipeline-step-num">0{i + 1}</span>
            <span className="pipeline-step-label">{step}</span>
            {i < 4 && <span className="pipeline-arrow">›</span>}
          </div>
        ))}
      </div>

      {error && <div className="error-banner">⚠ {error}</div>}

      {/* ── Run history ─────────────────────────────────────────────── */}
      {runs.length > 0 && !running && (
        <RunHistory
          runs={runs}
          currentRunId={currentRunId}
          onSelect={loadRun}
          onDelete={handleDeleteRun}
          onNew={clearAll}
        />
      )}

      {/* ── Upload zone ─────────────────────────────────────────────── */}
      {rows.length === 0 && !hasResults && (
        <div
          className={`upload-zone ${dragOver ? "drag-over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
        >
          <div className="upload-triangle">
            <VercelTriangle size={32} color="var(--v-gray-400)" />
          </div>
          <div className="upload-title">Deploy your prospect list</div>
          <div className="upload-sub">
            Drop a CSV or click to browse. HubSpot, Sales Navigator, and Lemlist exports work out of the box.
          </div>
          <button
            className="primary-btn"
            onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
          >
            Choose CSV
          </button>
          <div className="schema-hint">
            <div className="schema-label">Expected columns</div>
            <div className="schema-cols">
              {["first_name", "last_name", "company_name", "website", "title", "linkedin_url"].map((col) => (
                <span className="schema-col" key={col}>{col}</span>
              ))}
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            style={{ display: "none" }}
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
      )}

      {/* ── File bar ────────────────────────────────────────────────── */}
      {rows.length > 0 && !hasResults && (
        <div className="file-bar">
          <div className="file-bar-left">
            <span className="file-dot" />
            <span className="file-name">{fileName}</span>
            <span className="file-count">{rows.length} contact{rows.length === 1 ? "" : "s"} · ready to deploy</span>
          </div>
          <div className="file-bar-right">
            {!running && <button className="ghost-btn" onClick={clearAll}>Clear</button>}
            {!running && (
              <button className="primary-btn run-btn" onClick={runResearch}>
                <VercelTriangle size={11} color="currentColor" />
                Deploy pipeline
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Stats bar ───────────────────────────────────────────────── */}
      {hasResults && (
        <div className="stats-bar">
          <div className="stat">
            <div className="stat-num">{stats.total}</div>
            <div className="stat-label">Contacts</div>
          </div>
          <div className="stat">
            <div className="stat-num" style={{ color: "var(--v-success)" }}>{stats.high}</div>
            <div className="stat-label">High confidence</div>
          </div>
          <div className="stat">
            <div className="stat-num" style={{ color: "var(--v-warning)" }}>{stats.medium}</div>
            <div className="stat-label">Medium</div>
          </div>
          <div className="stat">
            <div className="stat-num" style={{ color: "var(--v-error)" }}>{stats.skipped}</div>
            <div className="stat-label">Skipped</div>
          </div>
        </div>
      )}

      {/* ── Build log (progress) ─────────────────────────────────────── */}
      {progress.length > 0 && running && (
        <div className="progress-section">
          <div className="progress-header">
            <div className="progress-title">
              <span className="build-spinner" />
              Building…
            </div>
            <div className="progress-count">
              {progress.filter((p) => ["done", "skipped", "error"].includes(p.status)).length}
              &nbsp;/&nbsp;{progress.length}
            </div>
          </div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="progress-rows">
            {progress.map((p, i) => (
              <div key={i} className={`progress-row ${p.status}`}>
                <span className={`p-status ${p.status}`}>
                  {p.status === "processing" ? (
                    <span className="spinner" />
                  ) : p.status === "done" ? "✓" : p.status === "skipped" ? "–" : p.status === "error" ? "✕" : "·"}
                </span>
                <span className="p-name">{p.name}</span>
                <span className="p-step">{p.step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────────────── */}
      {hasResults && !running && (
        <>
          <div className="results-header">
            <div className="results-title">Output</div>
            <div className="results-actions">
              <button className="ghost-btn" onClick={clearAll}>New upload</button>
              <button className="primary-btn" onClick={() => downloadResultsCSV(contacts)}>
                ↓ Export CSV
              </button>
            </div>
          </div>
          <div className="contact-grid">
            {contacts.map((c) => (
              <ContactCard key={c.id} contact={c} />
            ))}
          </div>
        </>
      )}

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="app-footer">
        <span>Built on Vercel · EMEA Startups GTM tooling</span>
        <span className="footer-sep">·</span>
        <span>claude-sonnet-4 · Edge Runtime · Next.js 15 · IndexedDB</span>
      </footer>

    </div>
  );
}
