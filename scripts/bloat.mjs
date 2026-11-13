#!/usr/bin/env node
/**
 * lean-code bloat meter — zero dependency, heuristic, not a linter.
 *
 *   node bloat.mjs --diff [base]     changed-code report (default base: HEAD)
 *   node bloat.mjs src lib          static report for files/directories
 *
 * Options: --json | --strict | --max-net=N | --max-func=N | --max-new-files=N | --max-dup=N
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "out", "coverage", ".next", ".nuxt", "vendor", "__pycache__", ".venv", "venv", ".cache", "target", "bin", "obj", ".idea"]);
const EXT = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".py"]);
const TICK = "\x60";
const FN_RE = [
  /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\b/,
  /^\s*(?:export\s+)?(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*(?::[^=]+)?=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*(?::[^=]+)?=>|[A-Za-z_$][\w$]*\s*=>)/,
  /^\s*(?:public\s+|private\s+|protected\s+|static\s+|async\s+|get\s+|set\s+)*[A-Za-z_$][\w$]*\s*\([^;{}]*\)\s*(?::\s*[^{]+)?\{?\s*$/,
];
const CONTROL_RE = /^\s*(?:if|for|while|switch|catch|return|else|do|try|with|elif)\b/;
const TRIVIAL = new Set(["}", "{", ")", "(", ");", "};", "end", "else:", "pass", "break", "continue"]);
const DUP_WINDOW = 5;

const opts = { maxNet: 150, maxFunc: 60, maxNewFiles: 3, maxDup: 0, strict: false, json: false, diff: null, paths: [] };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--json") opts.json = true;
  else if (a === "--strict") opts.strict = true;
  else if (a === "-h" || a === "--help") { console.log(help()); process.exit(0); }
  else if (a === "--diff") {
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) { opts.diff = next; i++; } else opts.diff = "HEAD";
  }
  else if (a.startsWith("--diff=")) opts.diff = a.slice(7) || "HEAD";
  else if (a.startsWith("--max-net=")) opts.maxNet = Number(a.slice(10));
  else if (a.startsWith("--max-func=")) opts.maxFunc = Number(a.slice(11));
  else if (a.startsWith("--max-new-files=")) opts.maxNewFiles = Number(a.slice(16));
  else if (a.startsWith("--max-dup=")) opts.maxDup = Number(a.slice(10));
  else if (!a.startsWith("--")) opts.paths.push(a);
}

function help() {
  return [
    "lean-code bloat meter",
    "",
    "  node bloat.mjs --diff [base]   report the working-tree diff (default HEAD)",
    "  node bloat.mjs <paths...>      report existing files/directories",
    "",
    "  --json             machine-readable output",
    "  --strict           exit 1 when any warning fires",
    "  --max-net=N        net added lines budget (default 150)",
    "  --max-func=N       longest function budget in lines (default 60)",
    "  --max-new-files=N  new-file budget (default 3)",
    "  --max-dup=N        duplicated 5-line block budget (default 0)",
  ].join("\n");
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 128 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}

function stripJs(src) {
  const out = new Array(src.length);
  let state = "code", i = 0;
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (state === "code") {
      if (c === "/" && d === "/") { state = "line"; out[i] = " "; out[i + 1] = " "; i += 2; continue; }
      if (c === "/" && d === "*") { state = "block"; out[i] = " "; out[i + 1] = " "; i += 2; continue; }
      if (c === "'" || c === '"') { state = c; out[i] = " "; i++; continue; }
      if (c === TICK) { state = "tpl"; out[i] = " "; i++; continue; }
      out[i] = c; i++; continue;
    }
    if (state === "line") { out[i] = c === "\n" ? "\n" : " "; if (c === "\n") state = "code"; i++; continue; }
    if (state === "block") {
      if (c === "*" && d === "/") { out[i] = " "; out[i + 1] = " "; i += 2; state = "code"; continue; }
      out[i] = c === "\n" ? "\n" : " "; i++; continue;
    }
    if (c === "\\") { out[i] = " "; out[i + 1] = d === "\n" ? "\n" : " "; i += 2; continue; }
    if ((state === "'" && c === "'") || (state === '"' && c === '"') || (state === "tpl" && c === TICK)) { out[i] = " "; state = "code"; i++; continue; }
    out[i] = c === "\n" ? "\n" : " "; i++;
  }
  return out.join("");
}

/** Spans that start on a function-like line and close when brace depth returns to its start. */
function jsFunctions(src, file) {
  const lines = stripJs(src).split("\n");
  const res = [];
  const open = [];
  let depth = 0;
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const base = depth;
    const candidate = !CONTROL_RE.test(line) && FN_RE.some((re) => re.test(line));
    let opened = false;
    for (const ch of line) {
      if (ch === "{") { depth++; if (depth === base + 1) opened = true; }
      else if (ch === "}") depth--;
    }
    if (candidate && (opened || /\{\s*$/.test(line))) open.push({ line: li + 1, base });
    for (let k = open.length - 1; k >= 0; k--) {
      if (depth <= open[k].base && li + 1 > open[k].line) {
        res.push({ file, line: open[k].line, length: li + 1 - open[k].line + 1 });
        open.splice(k, 1);
      }
    }
  }
  return res;
}

function stripPy(src) {
  return src.replace(/("""|''')[\s\S]*?\1/g, (block) => block.replace(/[^\n]/g, " "));
}

function pyFunctions(src, file) {
  const lines = stripPy(src).split("\n");
  const res = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)(?:async\s+)?def\s+([A-Za-z_]\w*)/.exec(lines[i]);
    if (!m) continue;
    const indent = m[1].length;
    let end = i;
    for (let j = i + 1; j < lines.length; j++) {
      if (!lines[j].trim()) continue;
      const ind = /^\s*/.exec(lines[j])[0].length;
      if (ind <= indent) break;
      end = j;
    }
    res.push({ file, line: i + 1, name: m[2], length: end - i + 1 });
  }
  return res;
}

function codeLine(line) {
  const s = line
    .replace(/^\s*\/\/.*$/, "")
    .replace(/^\s*#.*$/, "")
    .replace(/'[^']*'/g, "''")
    .replace(/"[^"]*"/g, '""')
    .replace(new RegExp(TICK + "[^" + TICK + "]*" + TICK, "g"), TICK + TICK);
  return s.trim().replace(/\s+/g, " ");
}

const BOILER = /^(?:import\b|export\s+(?:\{|\*|default)|from\s+\S+\s+import\b|require\(|const\s+\{[^}]*\}\s*=\s*require\b|["']use strict["']|#!\/)/;

/** 5-line normalized windows of real code that repeat. Imports, comments and string contents are ignored. */
function duplicateBlocks(entries, minChars) {
  const groups = new Map();
  const seen = new Set();
  for (const { file, startLine, lines } of entries) {
    const norm = lines.map(codeLine);
    for (let i = 0; i + DUP_WINDOW <= norm.length; i++) {
      const win = norm.slice(i, i + DUP_WINDOW);
      if (win.some((l) => l.length < minChars || BOILER.test(l) || TRIVIAL.has(l) || !/[A-Za-z_]/.test(l))) continue;
      const key = win.join("\n");
      const pos = file + ":" + (startLine + i);
      if (seen.has(pos)) continue;
      seen.add(pos);
      const hit = groups.get(key);
      if (hit) hit.push({ file, line: startLine + i });
      else groups.set(key, [{ file, line: startLine + i }]);
    }
  }

  const out = [];
  for (const [key, locs] of groups) {
    if (locs.length < 2) continue;
    out.push({ count: locs.length, locs, sample: key.split("\n")[0].slice(0, 80) });
  }
  out.sort((a, b) => b.count - a.count);
  // One copy region produces one hit per starting offset; keep only the first.
  const kept = [];
  for (const g of out) {
    const overlap = kept.some((k) => g.locs.every((l) => k.locs.some((m) => m.file === l.file && Math.abs(m.line - l.line) < DUP_WINDOW)));
    if (!overlap) kept.push(g);
  }
  return kept.slice(0, 10);
}

function maxBraceDepth(src) {
  let depth = 0, max = 0;
  for (const ch of stripJs(src)) {
    if (ch === "{") { depth++; if (depth > max) max = depth; }
    else if (ch === "}") depth--;
  }
  return max;
}

function maxPyIndent(src) {
  let max = 0;
  for (const line of src.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (!trimmed.endsWith(":")) continue;
    max = Math.max(max, Math.floor(/^\s*/.exec(line)[0].length / 4));
  }
  return max;
}

function collectPaths(targets, out) {
  for (const target of targets) {
    let st;
    try { st = statSync(target); } catch { out.push({ file: target, error: "not found" }); continue; }
    if (st.isDirectory()) {
      for (const name of readdirSync(target)) {
        if (SKIP_DIRS.has(name)) continue;
        collectPaths([join(target, name)], out);
      }
    } else if (EXT.has(extname(target))) out.push({ file: target });
  }
}

function analyzeSource(file, src) {
  const isPython = extname(file) === ".py";
  const funcs = isPython ? pyFunctions(src, file) : jsFunctions(src, file);
  const lines = src.split("\n");
  const codeLines = lines.filter((l) => l.trim() && !/^\s*(\/\/|#|\/\*|\*)/.test(l)).length;
  return {
    file,
    loc: codeLines,
    maxFunc: funcs.reduce((a, f) => Math.max(a, f.length), 0),
    top: funcs.sort((a, b) => b.length - a.length).slice(0, 3),
    depth: isPython ? maxPyIndent(src) : maxBraceDepth(src),
    entry: { file, startLine: 1, lines },
  };
}

function emptyFlags() {
  return { tryBlocks: 0, catches: 0, any: 0, todo: 0, commentedCode: 0, consoleLog: 0 };
}

function bumpFlags(text, flags) {
  if (/^\s*try\b/.test(text)) flags.tryBlocks++;
  if (/^\s*\}?\s*catch\b/.test(text)) flags.catches++;
  if (/:\s*any\b|\bas\s+any\b|\bas\s+unknown\b|<any>/.test(text)) flags.any++;
  if (/\b(TODO|FIXME|HACK|XXX)\b/.test(text)) flags.todo++;
  if (/^\s*(\/\/|#)\s*(const|let|var|function|def|class|return|if|for|while|import|from|await)\b/.test(text)) flags.commentedCode++;
  if (/\bconsole\.log\(|\bprint\(/.test(text)) flags.consoleLog++;
}

function parsePatch(patch) {
  const entries = [];
  const flags = emptyFlags();
  let current = null, newLine = 0;
  for (const line of patch.split("\n")) {
    if (line.startsWith("+++ b/")) { current = { file: line.slice(6), startLine: 0, lines: [], ranges: [] }; entries.push(current); continue; }
    if (line.startsWith("+++ /dev/null")) { current = null; continue; }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk) {
      newLine = Number(hunk[1]);
      if (current) current.ranges.push({ start: newLine, count: hunk[2] === undefined ? 1 : Number(hunk[2]) });
      continue;
    }
    if (!current) continue;
    if (line.startsWith("+") && !line.startsWith("+++")) {
      const text = line.slice(1);
      current.lines.push(text);
      if (current.startLine === 0) current.startLine = newLine;
      newLine++;
      bumpFlags(text, flags);
    } else if (line.startsWith(" ")) {
      newLine++;
    }
  }
  return { entries: entries.filter((e) => e.lines.length), flags };
}

function diffReport(base) {
  try { process.chdir(git(["rev-parse", "--show-toplevel"]).trim()); } catch { /* not a repo, numstat reports it */ }
  let numstat;
  try {
    numstat = git(["diff", "--numstat", base]);
  } catch (error) {
    console.error("bloat: cannot diff against " + base + " (not a git repo?)");
    console.error(String(error.stderr || error.message).split("\n")[0]);
    process.exit(2);
  }
  const addedFiles = new Set(git(["diff", "--name-only", "--diff-filter=A", base]).split("\n").filter(Boolean));
  const deletedFiles = git(["diff", "--name-only", "--diff-filter=D", base]).split("\n").filter(Boolean).length;

  const files = [];
  for (const line of numstat.split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split("\t");
    if (parts.length < 3) continue;
    const [a, d, path] = parts;
    files.push({ file: path, added: a === "-" ? 0 : Number(a), removed: d === "-" ? 0 : Number(d), isNew: addedFiles.has(path) || d === "-" });
  }
  const untracked = git(["ls-files", "--others", "--exclude-standard"]).split("\n").filter(Boolean);
  const untrackedEntries = [];
  for (const file of untracked) {
    if (!EXT.has(extname(file))) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    files.push({ file, added: lines.length, removed: 0, isNew: true });
    untrackedEntries.push({ file, startLine: 1, lines, ranges: [{ start: 1, count: Math.max(1, lines.length) }] });
  }

  const parsed = parsePatch(git(["diff", "-U0", base]));
  for (const entry of untrackedEntries) {
    for (const line of entry.lines) bumpFlags(line, parsed.flags);
  }
  const allEntries = [...parsed.entries, ...untrackedEntries];

  const sources = [];
  for (const entry of parsed.entries) {
    if (!EXT.has(extname(entry.file))) continue;
    try { sources.push({ file: entry.file, src: readFileSync(entry.file, "utf8") }); } catch { /* renamed away */ }
  }
  for (const entry of untrackedEntries) sources.push({ file: entry.file, src: entry.lines.join("\n") });

  const inHunk = (file, line) => {
    const entry = allEntries.find((e) => e.file === file);
    if (!entry) return true;
    return entry.ranges.some((r) => line >= r.start && line < r.start + r.count);
  };
  const funcs = [];
  for (const s of sources) {
    const found = extname(s.file) === ".py" ? pyFunctions(s.src, s.file) : jsFunctions(s.src, s.file);
    funcs.push(...found.filter((fn) => inHunk(s.file, fn.line)));
  }
  const dup = duplicateBlocks(allEntries, 10);
  const added = files.reduce((a, f) => a + f.added, 0);
  const removed = files.reduce((a, f) => a + f.removed, 0);
  const newFiles = files.filter((f) => f.isNew);
  const net = added - removed;

  const warnings = [];
  if (net > opts.maxNet) warnings.push("net lines " + net + " > budget " + opts.maxNet);
  if (newFiles.length > opts.maxNewFiles) warnings.push("new files " + newFiles.length + " > budget " + opts.maxNewFiles);
  const longFunc = funcs.filter((f) => f.length > opts.maxFunc).sort((a, b) => b.length - a.length);
  for (const f of longFunc.slice(0, 3)) warnings.push("function " + f.length + " lines at " + f.file + ":" + f.line);
  if (dup.length > opts.maxDup) warnings.push("duplicated 5-line blocks: " + dup.length + " group(s)");
  if (parsed.flags.commentedCode > 0) warnings.push("commented-out code lines: " + parsed.flags.commentedCode);

  return {
    mode: "diff", base,
    files: files.sort((a, b) => b.added - a.added),
    summary: { files: files.length, added, removed, net, newFiles: newFiles.length, deletedFiles },
    funcs: longFunc, duplicates: dup, flags: parsed.flags, warnings,
  };
}

function sourceReport(paths) {
  const found = [];
  collectPaths(paths, found);
  const missing = found.filter((f) => f.error).length;
  const results = found.filter((f) => !f.error).map((f) => analyzeSource(f.file, readFileSync(f.file, "utf8")));
  const funcs = results.flatMap((r) => r.top);
  const dup = duplicateBlocks(results.map((r) => r.entry), 10);
  const longFunc = funcs.filter((f) => f.length > opts.maxFunc).sort((a, b) => b.length - a.length);
  const warnings = [];
  for (const f of longFunc.slice(0, 3)) warnings.push("function " + f.length + " lines at " + f.file + ":" + f.line);
  return {
    mode: "files",
    files: results.sort((a, b) => b.loc - a.loc),
    summary: { files: results.length, loc: results.reduce((a, r) => a + r.loc, 0), missing },
    funcs: longFunc, duplicates: dup, flags: {}, warnings,
  };
}

function printHuman(r) {
  const lines = ["lean-code bloat report", ""];
  if (r.mode === "diff") {
    const s = r.summary;
    lines.push("diff vs " + r.base + ": " + s.files + " file(s), +" + s.added + " / -" + s.removed + ", net " + (s.net >= 0 ? "+" : "") + s.net);
    lines.push("new files: " + s.newFiles + "   deleted: " + s.deletedFiles);
    if (r.files.length) {
      lines.push("largest:");
      for (const f of r.files.slice(0, 4)) lines.push("  +" + f.added + " -" + f.removed + "  " + f.file + (f.isNew ? "  [new]" : ""));
    }
    const bits = [];
    if (r.flags.tryBlocks) bits.push("try x" + r.flags.tryBlocks);
    if (r.flags.catches) bits.push("catch x" + r.flags.catches);
    if (r.flags.any) bits.push("any x" + r.flags.any);
    if (r.flags.todo) bits.push("TODO x" + r.flags.todo);
    if (r.flags.commentedCode) bits.push("commented-code x" + r.flags.commentedCode);
    if (r.flags.consoleLog) bits.push("prints x" + r.flags.consoleLog);
    if (bits.length) lines.push("flags: " + bits.join(", "));
  } else {
    lines.push(r.summary.files + " file(s), " + r.summary.loc + " code lines");
    const shown = r.files.filter((f) => f.maxFunc > 0).slice(0, 3);
    if (shown.length) {
      lines.push("largest functions:");
      for (const f of shown) lines.push("  " + f.maxFunc + " lines  " + f.file + (f.depth ? ", depth " + f.depth : ""));
    }
  }
  if (r.duplicates.length) {
    lines.push("duplicates:");
    for (const d of r.duplicates) lines.push("  x" + d.count + "  " + d.locs.map((l) => l.file + ":" + l.line).join(", "));
  }
  lines.push("");
  if (r.warnings.length) {
    for (const w of r.warnings) lines.push("WARN  " + w);
    lines.push("");
    lines.push("verdict: WARN — slim it down, or state why the size is justified.");
  } else {
    lines.push("verdict: OK — nothing above budget.");
  }
  console.log(lines.join("\n"));
}

if (opts.diff !== null) {
  const report = diffReport(opts.diff);
  if (opts.json) console.log(JSON.stringify(report, null, 2));
  else printHuman(report);
  process.exit(opts.strict && report.warnings.length ? 1 : 0);
} else if (opts.paths.length) {
  const report = sourceReport(opts.paths);
  if (opts.json) console.log(JSON.stringify(report, null, 2));
  else printHuman(report);
  process.exit(opts.strict && report.warnings.length ? 1 : 0);
} else {
  console.log(help());
}
