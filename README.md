# lean-code-skill

**Make coding agents write less — and prove it before shipping.**

LLM agents are trained to be helpful: they add a strategy interface for one implementation, a `try/catch` that only logs and rethrows, a DTO that mirrors the entity, a config object nobody ever changes. It compiles, it demos, and it costs you every time you touch it.

This repo packages a portable **SKILL.md** protocol plus a **zero-dependency bloat meter** that turns "keep it simple" into numbers you can check in the diff.

## What you get

- **Budgets before coding** — net lines, new files, new dependencies, function length.
- **7 hard rules** — delete before add, inline one-caller helpers, rule of three, data over branches, deep modules, one validation boundary, dependency gradient.
- **A decision table** for ambiguous cases: config, strategy, wrappers, docs, tests.
- **15 anti-patterns** with before/after code.
- **A diff meter** — net lines, long functions, duplicated blocks, `try/catch`, `any`, TODOs, commented-out code.
- **A slim-down workflow** and a pre-delivery checklist.

## Install

DSH:

```bash
git clone https://github.com/kalotel771111-art/lean-code-skill.git ~/.dsh/skills/lean-code
```

Claude Code:

```bash
git clone https://github.com/kalotel771111-art/lean-code-skill.git ~/.claude/skills/lean-code
```

Any other agent: copy the directory and point the agent at `SKILL.md`.

## Use

Ask the agent to write, change, refactor or slim down code. The skill description triggers on those words. Before delivery it runs:

```bash
node ~/.dsh/skills/lean-code/scripts/bloat.mjs --diff
```

Flags: `--json`, `--strict`, `--max-net=150`, `--max-func=60`, `--max-new-files=3`, `--max-dup=0`.

Example:

```
lean-code bloat report

diff vs HEAD: 3 file(s), +170 / -2, net +168
new files: 1
largest:
  +91 -0  src/order.ts  [new]
flags: try x1, catch x1, any x2, TODO x1, commented-code x1

WARN  function 78 lines at src/order.ts:3
WARN  duplicated 5-line blocks: 1 group(s)
verdict: WARN — slim it down, or state why the size is justified.
```

## What the meter checks

- net added lines against `--max-net`
- new files against `--max-new-files`
- function length **only in changed hunks** — old code is not judged
- repeated 5-line blocks; imports, comments and string contents are ignored
- defensive noise: `try`, `catch`, `any` / `unknown`, TODO, commented-out code, prints

It is heuristic, not a linter. Expect false positives on generated code, fixtures and i18n text; the skill says to judge and ignore them.

## The rules, in one screen

Correctness > readability > brevity > extensibility.

1. Delete before adding.
2. Inline a helper with one caller.
3. Abstract on the third occurrence.
4. Tables over branch pyramids.
5. Small interface, deep implementation.
6. Validate once, at the boundary.
7. Built-in > existing dependency > new dependency.

Exceptions are explicit: two or more real implementations, public API, performance hotspots, security boundaries, explicit user request. "We might need it later" is not one.

## Layout

```
SKILL.md                 the protocol
references/
  anti-patterns.md       15 patterns with before/after
  checklist.md           pre-flight / coding / delivery checklist
  tools.md               knip, jscpd, sonarjs, ruff, radon, vulture…
  sources.md             Ousterhout, Sandi Metz, YAGNI, Simple Made Easy
scripts/
  bloat.mjs              zero-dependency meter (Node 18+)
```

## Compatibility

The layout follows the Agent Skills convention (`SKILL.md` + `references/` + `scripts/`). Tested with DSH on Android; Claude Code reads the same structure. `whenToUse` is optional metadata.

The skill body is in Chinese. An English translation is welcome as a PR.

## 中文说明

一句话：让 AI 写代码前先做减法，交付前用脚本量一遍。

```bash
git clone https://github.com/kalotel771111-art/lean-code-skill.git ~/.dsh/skills/lean-code
```

之后正常说「写个 XX / 精简这段 / 重构」，交付前它会跑 `scripts/bloat.mjs --diff`。规则、反模式、阈值都在 `SKILL.md` 和 `references/`。

## License

MIT
