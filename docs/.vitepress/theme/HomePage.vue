<script setup lang="ts">
import { withBase } from "vitepress";

// The real diff `syngraphe init` produces on a file that already had a heading and content. Kept as
// data rather than markup so the added lines cannot drift from their gutter.
const patch = [
  { added: false, text: "# AGENTS.md" },
  { added: false, text: "" },
  { added: true, text: '<!-- syngraphe:start version="1" -->' },
  { added: true, text: "<!-- Managed by Syngraphe. Do not edit this block manually. -->" },
  { added: true, text: "" },
  { added: true, text: "This repository maintains shared project context in `.context/`." },
  { added: true, text: "" },
  {
    added: true,
    text: "Before substantial work, read `.context/index.md` and the relevant context documents.",
  },
  {
    added: true,
    text: "Keep that context accurate: when a change makes it out of date, update it in the same change.",
  },
  {
    added: true,
    text: "If Syngraphe is available, run `syngraphe check` before completing substantial work.",
  },
  { added: true, text: "<!-- syngraphe:end -->" },
  { added: true, text: "" },
  { added: false, text: "## Build" },
];

const pillars = [
  {
    title: "The context is in the repository",
    text: "`.context/` is committed, reviewed and branched with the code it describes. No external service holds it, and nothing has to be exported before someone else can read it.",
  },
  {
    title: "Git is the history",
    text: "Versions, blame and diffs come from the repository itself. There is no second timeline to keep in sync and no database to migrate.",
  },
  {
    title: "Additive by construction",
    text: "Syngraphe owns only the text between its markers. Everything else is preserved byte for byte, a hand-edited block is reported rather than overwritten, and running init twice changes nothing.",
  },
];

const capabilities = [
  {
    title: "One bootstrap for every agent",
    text: "AGENTS.md is the canonical entry point. Claude gets a thin CLAUDE.md import; Cursor and Codex read AGENTS.md natively and get no extra files.",
  },
  {
    title: "Deterministic checks",
    text: "Structure, manifest, managed blocks, internal references and context freshness — all offline, all with stable codes you can pin a CI job to.",
  },
  {
    title: "Plan, then apply",
    text: "Every modifying command builds a plan, renders it, and applies exactly that plan. `--dry-run` runs the same planner and stops before writing.",
  },
  {
    title: "Machine-readable output",
    text: "`syngraphe check --json` emits a versioned payload of findings, and `--strict` turns warnings into a failing build.",
  },
  {
    title: "Careful with your files",
    text: "Complete-file writes via temporary file and rename, never outside the Git root, never through a symlink, never into a `.context/` that belongs to something else.",
  },
  {
    title: "Useful without Syngraphe",
    text: "If the executable disappears, the repository still has AGENTS.md, .context/, Markdown and Git history. Syngraphe implements the protocol; the protocol does not depend on it.",
  },
];
</script>

<template>
  <div class="syg-home">
    <!-- ── Hero ─────────────────────────────────────────────── -->
    <section class="syg-hero">
      <div class="syg-grid" aria-hidden="true"></div>

      <div class="syg-container syg-hero-inner">
        <div>
          <span class="syg-badge">
            <span class="syg-badge-dot"></span>
            v0.1 · context schema v1
          </span>

          <h1>Repository context that stays true.</h1>

          <p class="syg-lede">
            Syngraphe keeps a repository's own context in a small <code>.context/</code> directory
            of Markdown, one set of files your team and your coding agents both read.
            <code>AGENTS.md</code> points the agents at it; <code>syngraphe check</code> verifies
            the files are there, their references resolve, and the bootstrap block has not been
            edited.
          </p>

          <div class="syg-actions">
            <a class="syg-btn syg-btn--solid" :href="withBase('/getting-started/quickstart')">
              Quickstart
            </a>
            <a
              class="syg-btn syg-btn--ghost"
              href="https://github.com/suffro/syngraphe"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
                <path
                  d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.27-1.69-1.27-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"
                />
              </svg>
              <span>GitHub</span>
            </a>
          </div>
          <div class="syg-divider"></div>
          <div class="syg-sections-hooks">
            <a href="#pillars"><code>The concept</code></a>
            <a href="#how-it-works"><code>How it works</code></a>
            <a href="#the-layout"><code>The .context/</code></a>
            <a href="#capabilities"><code>Capabilities</code></a>
          </div>
        </div>

        <!--
          The diff, not a terminal.

          What is worth showing first is the artefact rather than the run: this is the entire change
          `init` makes to a file somebody already wrote, which is the claim the whole tool rests on.
        -->
        <figure class="syg-panel">
          <div class="syg-panel-bar">
            <span class="syg-panel-file">AGENTS.md</span>
            <span class="syg-panel-meta">+10 −0</span>
          </div>

          <div class="syg-diff">
            <div
              v-for="(line, index) in patch"
              :key="index"
              class="syg-diff-line"
              :class="line.added ? 'is-add' : 'is-context'"
            >
              <span class="syg-diff-sign" aria-hidden="true">{{ line.added ? "+" : " " }}</span
              ><span class="syg-diff-text">{{ line.text }}</span>
            </div>
          </div>

          <figcaption class="syg-caption">
            Everything <code>syngraphe init</code> adds to an <code>AGENTS.md</code> you already
            have. Remove the block and the file is byte for byte what it was.
          </figcaption>
        </figure>
      </div>
    </section>

    <!-- ── Pillars ──────────────────────────────────────────── -->
    <section class="syg-section" id="pillars">
      <div class="syg-container">
        <span class="syg-eyebrow">The concept</span>
        <h2>Project knowledge belongs where the code is.</h2>
        <p class="syg-sub">
          Architecture notes live in chat threads, conventions live in one person's head, and the
          reason behind a decision lives nowhere at all. Syngraphe puts that knowledge in the
          repository, in plain Markdown, where it is reviewed like anything else.
        </p>

        <div class="syg-cards">
          <div v-for="pillar in pillars" :key="pillar.title" class="syg-card">
            <h3>{{ pillar.title }}</h3>
            <p>{{ pillar.text }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ── How it works ─────────────────────────────────────── -->
    <section class="syg-section" id="how-it-works">
      <div class="syg-container">
        <span class="syg-eyebrow">How it works</span>
        <h2>Three commands, no surprises.</h2>
        <p class="syg-sub">
          Each one also answers to the shorthand <code>syg</code>: <code>syg init</code>,
          <code>syg check</code>.
        </p>

        <div class="syg-steps">
          <div class="syg-step">
            <h3><code>syngraphe init</code></h3>
            <p>
              Creates <code>.context/</code> and adds a managed block to <code>AGENTS.md</code>.
              Run it with <code>--dry-run</code> first to see the exact plan; the real run applies
              that same plan and nothing else.
            </p>
          </div>
          <div class="syg-step">
            <h3><code>syngraphe status</code></h3>
            <p>
              A fast, read-only summary: schema, which context documents exist, how many decisions
              and history entries, which agents are wired up, and how many findings are open.
            </p>
          </div>
          <div class="syg-step">
            <h3><code>syngraphe check</code></h3>
            <p>
              The deterministic checks: structure, manifest, managed blocks, internal references and
              freshness. Human output by default, <code>--json</code> for CI,
              <code>--strict</code> to fail on warnings.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- ── What gets created ────────────────────────────────── -->
    <section class="syg-section" id="the-layout">
      <div class="syg-container">
        <span class="syg-eyebrow">The layout</span>
        <h2>Four kinds of context, separated by lifecycle.</h2>

        <div class="syg-split">
<pre class="syg-tree">.context/
├── manifest.json
├── index.md
├── truth/
│   ├── architecture.md
│   └── conventions.md
├── state/
│   └── current.md
├── decisions/
│   └── README.md
└── history/
    └── README.md</pre>

          <ul class="syg-list">
            <li>
              <strong>truth/</strong> — what is stably true: architecture, conventions, domain
              concepts, constraints and invariants.
            </li>
            <li>
              <strong>state/</strong> — what is true this week: current focus, recent relevant
              changes, next steps, blockers.
            </li>
            <li>
              <strong>decisions/</strong> — what was decided and why, one Markdown file per
              decision, including the alternatives that were rejected.
            </li>
            <li>
              <strong>history/</strong> — what used to be true: completed or superseded operational
              context, kept out of the active reading path.
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- ── Capabilities ─────────────────────────────────────── -->
    <section class="syg-section" id="capabilities">
      <div class="syg-container">
        <span class="syg-eyebrow">What it gives you</span>
        <h2>Small tool, strict guarantees.</h2>

        <div class="syg-cards">
          <div v-for="capability in capabilities" :key="capability.title" class="syg-card">
            <h3>{{ capability.title }}</h3>
            <p>{{ capability.text }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ── CTA ──────────────────────────────────────────────── -->
    <section class="syg-cta">
      <div class="syg-container">
        <h2>Start with a dry run.</h2>
        <p>
          Syngraphe writes nothing until you have seen the plan. Point it at a repository you
          already have and read what it proposes.
        </p>
        <div class="syg-actions">
          <a class="syg-btn syg-btn--solid" :href="withBase('/getting-started/installation')">
            Install
          </a>
          <a
            class="syg-btn syg-btn--ghost"
            href="https://github.com/suffro/syngraphe"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub
          </a>
        </div>
      </div>
    </section>
  </div>
</template>


<style>

.syg-actions {
  margin-bottom: 15px;
}

.syg-sections-hooks {
  font-size: medium;
  display: flex;
  justify-content: start;
  gap: 10px;
}

.syg-sections-hooks a {
  opacity: 0.35;
}

.syg-sections-hooks a:hover {
  cursor: pointer;
  opacity: 1;
}

</style>