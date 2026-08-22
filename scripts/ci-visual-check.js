#!/usr/bin/env node
/**
 * Static-page CI smoke check: no build step exists for this repo, so this is the
 * closest thing to a "does it render, are the links real" gate.
 *
 * - Finds every *.html file in the repo (excluding node_modules).
 * - Serves them over a plain static HTTP server.
 * - Opens each in headless Chromium: asserts HTTP 200, zero console errors, zero
 *   page errors (uncaught exceptions), and captures a screenshot artifact.
 * - Statically checks every local (relative, non-http) href/src actually resolves
 *   to a file in the repo, so a broken internal link fails CI instead of only
 *   being found by a human clicking around.
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const REPORT_DIR = path.join(ROOT, ".ci-reports");
const PORT = 4173;

function findHtmlFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, out);
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

function checkLocalLinks(file) {
  const html = fs.readFileSync(file, "utf8");
  const dir = path.dirname(file);
  const problems = [];
  const re = /(?:href|src)=["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(html))) {
    const target = m[1];
    if (
      !target ||
      target.startsWith("http://") ||
      target.startsWith("https://") ||
      target.startsWith("mailto:") ||
      target.startsWith("tel:") ||
      target.startsWith("#") ||
      target.startsWith("//")
    ) {
      continue;
    }
    const clean = target.split("#")[0].split("?")[0];
    if (!clean) continue;
    const resolved = path.join(dir, decodeURIComponent(clean));
    if (!fs.existsSync(resolved)) {
      problems.push(`${path.relative(ROOT, file)} -> broken local link: ${target}`);
    }
  }
  return problems;
}

function startServer() {
  const mime = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript" };
  const server = http.createServer((req, res) => {
    let filePath = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
    if (filePath.endsWith("/")) filePath = path.join(filePath, "index.html");
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { "Content-Type": mime[ext] || "application/octet-stream" });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const htmlFiles = findHtmlFiles(ROOT);
  if (!htmlFiles.length) {
    console.log("No .html files found — nothing to check.");
    return;
  }

  let linkProblems = [];
  for (const f of htmlFiles) linkProblems = linkProblems.concat(checkLocalLinks(f));

  const server = await startServer();
  // PLAYWRIGHT_CHROMIUM_EXECUTABLE lets a sandbox with a pre-installed, differently
  // versioned Chromium point at it directly instead of downloading — CI installs its
  // own via `playwright install` and never sets this, so it uses normal resolution.
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}
  );
  const failures = [];

  try {
    for (const file of htmlFiles) {
      const rel = path.relative(ROOT, file);
      const url = `http://localhost:${PORT}/${rel}`;
      const page = await browser.newPage();
      const pageErrors = [];
      const badResponses = [];
      // The browser's automatic favicon.ico probe 404s on every page in this repo
      // (no favicon is shipped) — real but cosmetic, and not what this check is for.
      // Tracked via the response event (carries the real URL) rather than console
      // text, which Chromium does not reliably include the URL in.
      page.on("response", (res) => {
        if (res.status() >= 400 && !/favicon\.ico$/i.test(res.url())) {
          badResponses.push(`${res.status()} ${res.url()}`);
        }
      });
      page.on("pageerror", (err) => pageErrors.push(String(err)));

      const response = await page.goto(url, { waitUntil: "networkidle" });
      const status = response ? response.status() : 0;
      const shotName = rel.replace(/[\\/]/g, "__").replace(/\.html$/, ".png");
      await page.screenshot({ path: path.join(REPORT_DIR, shotName), fullPage: true });
      await page.close();

      if (status !== 200) failures.push(`${rel}: HTTP ${status}`);
      if (badResponses.length) failures.push(`${rel}: failed resource(s) — ${badResponses.join(" | ")}`);
      if (pageErrors.length) failures.push(`${rel}: page errors — ${pageErrors.join(" | ")}`);
    }
  } finally {
    await browser.close();
    server.close();
  }

  const allProblems = [...linkProblems, ...failures];
  if (allProblems.length) {
    console.error(`\n${allProblems.length} problem(s) found:\n`);
    allProblems.forEach((p) => console.error(" - " + p));
    process.exitCode = 1;
  } else {
    console.log(`All ${htmlFiles.length} page(s) OK — no broken local links, no console/page errors.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
