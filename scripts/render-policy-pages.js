#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const seedPath = process.argv[2];
if (!seedPath) {
  throw new Error('Usage: node scripts/render-policy-pages.js /absolute/path/to/legalPolicySeeds.js');
}

const resolvedSeedPath = path.resolve(seedPath);
const { SEEDS } = require(resolvedSeedPath);
const sourceHash = process.env.POLICY_SOURCE_SHA || 'unrecorded-source';

const pages = {
  privacy_policy: 'privacy.html',
  community_guidelines: 'community-guidelines.html',
  public_forum_terms: 'public-forum-terms.html',
  open_source_notices: 'open-source-notices.html',
  terms_jobseeker: 'terms/jobseeker.html',
  terms_recruiter: 'terms/recruiter.html',
  terms_individual: 'terms/individual.html',
  terms_customer: 'terms/customer.html',
};

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'section';
}

function inline(value) {
  let text = escapeHtml(value);
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>');
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return text;
}

function renderMarkdown(markdown) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    out.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    out.push(`<${list.type}>${list.items.map((item) => `<li>${inline(item)}</li>`).join('')}</${list.type}>`);
    list = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (index === 0 && line.startsWith('# ')) continue;
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    if (/^---+$/.test(line)) {
      flushParagraph();
      flushList();
      out.push('<hr />');
      continue;
    }
    const heading = /^(#{2,3})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      const label = heading[2];
      out.push(`<h${level} id="${slug(label)}">${inline(label)}</h${level}>`);
      continue;
    }
    const unordered = /^[-*]\s+(.+)$/.exec(line);
    const ordered = /^\d+\.\s+(.+)$/.exec(line);
    if (unordered || ordered) {
      flushParagraph();
      const type = unordered ? 'ul' : 'ol';
      if (list && list.type !== type) flushList();
      if (!list) list = { type, items: [] };
      list.items.push((unordered || ordered)[1]);
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return out.join('\n');
}

function navPrefix(outputPath) {
  return outputPath.startsWith('terms/') ? '../' : './';
}

function renderPage(key, outputPath) {
  const seed = SEEDS[key];
  if (!seed) throw new Error(`Missing canonical policy seed: ${key}`);
  const prefix = navPrefix(outputPath);
  const nav = [
    ['Privacy', `${prefix}privacy.html`],
    ['Support', `${prefix}support.html`],
    ['Jobseeker terms', `${prefix}terms/jobseeker.html`],
    ['Business terms', `${prefix}terms/recruiter.html`],
    ['Sole Trader terms', `${prefix}terms/individual.html`],
    ['Customer terms', `${prefix}terms/customer.html`],
    ['Community', `${prefix}community-guidelines.html`],
    ['Forum terms', `${prefix}public-forum-terms.html`],
    ['Open source', `${prefix}open-source-notices.html`],
  ].map(([label, href]) => `<a href="${href}">${label}</a>`).join('\n        ');

  return `<!DOCTYPE html>
<html lang="en-AU">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="generator-source" content="${escapeHtml(sourceHash)}" />
  <title>${escapeHtml(seed.title)} — SquadGoo</title>
  <style>
    :root { --ink:#12241c; --muted:#4a5f55; --line:#d5e0da; --bg:#f4f7f5; --card:#fff; --accent:#1a6b4a; }
    * { box-sizing:border-box; }
    body { margin:0; color:var(--ink); background:linear-gradient(180deg,#e8f0eb 0,var(--bg) 160px,#fff 100%); font:16px/1.65 "Segoe UI",system-ui,-apple-system,sans-serif; }
    header,main,footer { max-width:48rem; margin:0 auto; padding-left:1.25rem; padding-right:1.25rem; }
    header { padding-top:2.25rem; padding-bottom:1rem; }
    main { background:var(--card); border:1px solid var(--line); border-radius:14px; padding-top:1.4rem; padding-bottom:3rem; margin-bottom:2rem; }
    .brand { color:var(--accent); font-size:.78rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; }
    h1,h2,h3 { font-family:Georgia,"Times New Roman",serif; line-height:1.25; }
    h1 { margin:.35rem 0 .35rem; font-size:clamp(1.8rem,6vw,2.35rem); }
    h2 { margin:2rem 0 .65rem; padding-top:.4rem; border-top:1px solid var(--line); font-size:1.3rem; }
    h3 { margin:1.35rem 0 .5rem; font-size:1.08rem; }
    p,li { color:var(--muted); }
    a { color:var(--accent); }
    nav { display:flex; flex-wrap:wrap; gap:.55rem 1rem; margin-top:1rem; font-size:.88rem; }
    nav a { font-weight:650; text-decoration:none; }
    ul,ol { padding-left:1.35rem; }
    li { margin:.35rem 0; }
    code { background:#e8f3ee; padding:.05em .3em; border-radius:4px; }
    .meta,footer { color:var(--muted); font-size:.88rem; }
    footer { padding-bottom:2.5rem; }
    @media (max-width:420px) { header,main,footer { padding-left:1rem; padding-right:1rem; } main { border-left:0; border-right:0; border-radius:0; } nav a { min-height:44px; display:inline-flex; align-items:center; } }
    @media print { body { background:#fff; } nav { display:none; } main { border:0; } }
  </style>
</head>
<body>
  <header>
    <div class="brand">SquadGoo · Australia</div>
    <h1>${escapeHtml(seed.title)}</h1>
    <p class="meta">Version ${escapeHtml(seed.versionLabel)} · Effective ${escapeHtml(seed.effectiveFrom)}</p>
    <nav aria-label="Legal documents">
        ${nav}
    </nav>
  </header>
  <main>
${renderMarkdown(seed.content)}
  </main>
  <footer>Canonical policy version ${escapeHtml(seed.versionLabel)} · Contact support@squadgoo.com.au</footer>
</body>
</html>
`;
}

for (const [key, outputPath] of Object.entries(pages)) {
  const absolute = path.join(root, outputPath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, renderPage(key, outputPath));
  process.stdout.write(`rendered ${outputPath} from ${key}\n`);
}
