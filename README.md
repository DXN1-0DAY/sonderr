<div align="center">

<img src=".github/assets/sonderr-banner.svg" alt="Sonderr — AI coding agent" width="800"/>

**Built for complex systems. Runs on any model.**

Terminal-first, editor-integrated, desktop-wrapped. Bring your own key — your providers, your models, your machine.

[![License: MIT](https://img.shields.io/badge/license-MIT-FF6A00?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-typed-3178C6?style=flat-square)](https://www.typescript.org)
[![Bun](https://img.shields.io/badge/runtime-Bun-F472B6?style=flat-square)](https://bun.sh)
[![Stars](https://img.shields.io/github/stars/DXN1-termux/sonderr?style=flat-square&color=FF6A00)](https://github.com/DXN1-termux/sonderr/stargazers)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-2EA043?style=flat-square)](https://github.com/DXN1-termux/sonderr/pulls)

[Install](#install) · [Why Sonderr](#why-sonderr) · [Features](#features) · [Providers](#providers) · [Architecture](#architecture) · [Configuration](#configuration) · [Development](#development) · [License](#license)

</div>

---

## What is Sonderr

Sonderr is an agentic coding engine designed for one thing: **building complex systems**. Not toys. Not prototypes. Real, production-grade software — operating systems, game engines, compilers, distributed platforms, full-stack applications.

It plans, reads and edits code, runs commands, manages MCP servers, executes long-running tasks in the background while it keeps coding, and verifies its own work before reporting done. Powered by API keys you own (BYOK), with no hosted middleman and no subscription.

**You don't make CandyCrush with Sonderr. You make the next Unreal Engine.**

Built on the MIT-licensed [Kilo Code](https://github.com/Kilo-Org/kilocode) codebase, which itself derives from [opencode](https://github.com/sst/opencode). Credit and thanks to both upstream projects.

## Why Sonderr

### Model-agnostic quality

Sonderr's quality comes from its architecture, not just its model. The fable-grade system prompt (668+ lines), specialized skills, verification checklists, and planning system mean **even cheaper models deliver complex-system output**.

Run Gemini 2.5 Flash Lite. Run an old Claude. The skills and prompt infrastructure lift every model's capability. You get fable-5-duo-level results on cheaper, faster models because the system does the heavy lifting that raw model intelligence normally handles.

### Complexity-rated task system

Every task gets rated S1-S4 (simple), M1-M4 (medium), H1-H4 (hard), or U1-U10 (ultra). A U10 task — full OS creation, game engine, compiler — triggers extensive planning, parallel subagent execution, and deep verification. An S1 task — typo fix — gets done immediately with zero ceremony. The agent scales its process to the complexity of the work.

### Background task execution

Never wait when you can work. Install dependencies while coding. Run builds while documenting. Execute tests while making more changes. Sonderr's background process system means the agent keeps producing while long-running operations complete.

### Self-verification

Before reporting done, Sonderr runs verification checklists. It catches its own bugs, checks its own edge cases, and reviews its own diffs. What it reports as done actually works.

## Features

- **Complex systems** — Designed for OS kernels, game engines, compilers, distributed systems, not todo apps
- **Pure BYOK** — Any model from any provider. OpenAI, Anthropic, Gemini, or your own endpoint. Swap providers or models at runtime
- **Model-agnostic** — Skills + prompt infrastructure lift cheap models to high-end output quality
- **Background tasks** — Parallel execution: install, build, test while coding
- **Terminal UI** — Full TUI with sessions, plan mode, file/command tooling, real-time streaming
- **Desktop app** — Electron wrapper with encrypted config and first-run setup
- **Editor integrations** — VS Code extension with Agent Manager, JetBrains plugin
- **Enterprise MCP controls** — Dashboard-managed MCP server policy
- **Complexity ratings** — S1-S4, M1-M4, H1-H4, U1-U10 calibration
- **Verification skill** — Pre-completion checklists, self-review, quality gates
- **Planning skill** — Strategic decomposition, dependency mapping, subagent orchestration
- **Design skill** — Production-quality UI/UX guidance, no emojis, custom SVG icons
- **Open source** — MIT licensed, no vendor lock-in, no subscription

## Install

### Option 1: Global command (recommended)

```bash
git clone https://github.com/DXN1-termux/sonderr.git
cd sonderr
./scripts/install.sh
```

Then run from any directory:

```bash
sonderr
```

The global command self-bootstraps: git pull on every launch, auto-installs Bun if missing, syncs dependencies, always fresh. Make sure `~/.local/bin` is in your PATH:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

### Option 2: Run directly with Bun

Requires [Bun](https://bun.sh) 1.3+.

```bash
git clone https://github.com/DXN1-termux/sonderr.git
cd sonderr
bun install
bun run dev
```

### Option 3: Build production binary

```bash
bun install
bun run --cwd packages/cli build
```

Binary: `packages/cli/dist/@sonderr/cli/bin/sonderr`

## Providers

| Provider | Models |
|---|---|
| OpenAI | GPT-4o, o-series, and newer |
| Anthropic | Claude Sonnet 4.6, Opus 4.1, and newer |
| Gemini | Gemini 2.5 Pro / Flash / Flash Lite and newer |

Configure in-session with `/api_attach` or directly in `sonderr.json`. Keys are stored locally, encrypted, only sent to your configured provider.

**Run any model.** Sonderr's skill system means even fast, cheap models deliver complex-system output.

## Architecture

Bun + Turborepo monorepo, 35 packages:

| Package | Description |
|---|---|
| `@sonderr/cli` | Agent engine, CLI entry point, HTTP server |
| `@sonderr/tui` | Terminal UI (SolidJS + OpenTUI) |
| `@sonderr/core` | Session, tool, provider core |
| `@sonderr/server` | Local HTTP server |
| `@sonderr/protocol` | Client/server protocol definitions |
| `@sonderr/sdk` | Auto-generated JavaScript SDK |
| `@sonderr/gateway` | Custom provider/endpoint integration |
| `@sonderr-vscode` | VS Code extension with Agent Manager |
| `@sonderr-jetbrains` | JetBrains plugin |
| `sonderr-desktop` | Electron desktop app wrapper |
| `@sonderr-docs` | Documentation site |

## Configuration

| Scope | Path |
|---|---|
| CLI config | `~/.sonderr/` |
| Desktop config | `~/.config/sonderr/config.json` (AES-256-CBC, mode `0600`) |
| Project config | `.sonderr/` (commands, agents, plans, `sonderr.json`) |
| Global config | `~/.config/sonderr/` or `~/.sonderr/` |

## Development

```bash
bun install          # bootstrap all workspaces
bun run typecheck    # tsgo across packages
bun run lint         # oxlint
```

Tests live inside each package. Run with `bun test` from the package directory. Never from root.

## License

[MIT](LICENSE) — inherits and extends the licenses of Kilo Code and opencode.