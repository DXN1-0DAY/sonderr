/** @jsxImportSource @opentui/solid */
import { useDialog } from "@tui/ui/dialog"
import { DialogAlert } from "@tui/ui/dialog-alert"
import { DialogSelect, type DialogSelectOption } from "@tui/ui/dialog-select"
import { createMemo } from "solid-js"
import { TuiConfig } from "@/config/tui"

const MENU_OPTIONS = [
  { title: "Hive status", value: "status", description: "Show hive swarm status and configuration" },
  { title: "Swarm agents", value: "swarm-agents", description: "View available swarm agents" },
  { title: "Hive tools", value: "tools", description: "List the tools available inside a hive" },
  { title: "API pool", value: "api-pool", description: "Add or view available APIs for the swarm" },
  { title: "Configuration", value: "config", description: "How to enable and tune hive mode" },
] as const

const SWARM_AGENTS = [
  { name: "researcher", role: "Research", desc: "Investigate topics and gather evidence" },
  { name: "coder", role: "Implementation", desc: "Write production code and fix bugs" },
  { name: "reviewer", role: "Quality", desc: "Review code for bugs and issues" },
  { name: "tester", role: "Testing", desc: "Write and run tests" },
  { name: "documenter", role: "Docs", desc: "Write documentation and guides" },
  { name: "debugger", role: "Debugging", desc: "Diagnose and fix bugs" },
  { name: "architect", role: "Design", desc: "Design systems and plan implementations" },
] as const

const HIVE_TOOLS = [
  { name: "hive_send", desc: "Publish a memo to the hive swarm bus" },
  { name: "hive_recall", desc: "Read recent memos from the hive bus" },
  { name: "hive_create_proposal", desc: "Open a proposal for the swarm to vote on" },
  { name: "hive_vote", desc: "Cast a vote on an open proposal" },
  { name: "hive_close_proposal", desc: "Accept, reject, or cancel a proposal" },
  { name: "hive_list_proposals", desc: "List proposals in this hive" },
  { name: "hive_create_todo", desc: "Add a shared todo to the hive board" },
  { name: "hive_update_todo", desc: "Update status, assignee, or dependencies of a hive todo" },
  { name: "hive_list_todos", desc: "List the hive todo board" },
] as const

const ENV = {
  experimental: "SONDERR_EXPERIMENTAL",
  hive: "SONDERR_EXPERIMENTAL_HIVE",
  mode: "SONDERR_HIVE_MODE",
  maxAgents: "SONDERR_HIVE_MAX_AGENTS",
  maxConcurrent: "SONDERR_HIVE_MAX_CONCURRENT",
} as const

function truthy(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on"
}

type HiveState = {
  enabled: boolean
  enabledBy: string
  mode: string
  maxAgents: string
  maxConcurrent: string
}

/** Mirrors SonderrHiveConfig.resolve so the dialog reports what the engine actually sees. */
function readState(): HiveState {
  const direct = process.env[ENV.hive]
  const enabled = direct !== undefined ? truthy(direct) : truthy(process.env[ENV.experimental])
  const raw = process.env[ENV.mode] ?? "auto"
  const mode = raw === "off" || raw === "auto" || raw === "manual" ? raw : "auto"
  return {
    enabled: enabled && mode !== "off",
    enabledBy: direct !== undefined ? ENV.hive : truthy(process.env[ENV.experimental]) ? ENV.experimental : "unset",
    mode,
    maxAgents: process.env[ENV.maxAgents] ?? "8 (default)",
    maxConcurrent: process.env[ENV.maxConcurrent] ?? "4 (default)",
  }
}

export function DialogHive() {
  const dialog = useDialog()
  const state = createMemo(readState)

  const options = createMemo<DialogSelectOption<string>[]>(() =>
    MENU_OPTIONS.map((item) => ({
      title: item.title,
      footer: item.description,
      category: "Hive",
      value: item.value,
    })),
  )

  const showMain = () => dialog.replace(() => <DialogHive />)

  const alert = (title: string, lines: string[]) =>
    dialog.replace(() => <DialogAlert title={title} message={lines.join("\n")} onConfirm={showMain} />)

  const handleStatus = () => {
    const current = state()
    alert("Hive Status", [
      `Hive mode: ${current.enabled ? "enabled" : "disabled"}`,
      `Enabled by: ${current.enabledBy}`,
      `Mode: ${current.mode}`,
      `Max agents: ${current.maxAgents}`,
      `Max concurrent: ${current.maxConcurrent}`,
      "",
      current.enabled
        ? "Start a session with the `hive` agent to coordinate a swarm."
        : `Set ${ENV.hive}=1 (or ${ENV.experimental}=1) and restart to enable hive mode.`,
    ])
  }

  const handleSwarmAgents = () =>
    alert("Swarm Agents", [
      "Available swarm agents:",
      "",
      ...SWARM_AGENTS.map((a) => `  ${a.name} (${a.role}): ${a.desc}`),
      "",
      "The `hive` agent delegates to these via the `task` tool. Every spawned",
      "subagent joins the parent's hive automatically and shares its bus.",
    ])

  const handleTools = () =>
    alert("Hive Tools", [
      "Tools available to agents inside a hive:",
      "",
      ...HIVE_TOOLS.map((t) => `  ${t.name}: ${t.desc}`),
    ])

  const handleConfig = () =>
    alert("Hive Configuration", [
      "Hive mode is configured through environment variables:",
      "",
      `  ${ENV.hive}=1       enable hive mode (or ${ENV.experimental}=1)`,
      `  ${ENV.mode}=auto|manual|off   how hives are formed (default: auto)`,
      `  ${ENV.maxAgents}=8            max agents per hive`,
      `  ${ENV.maxConcurrent}=4        max agents running at once`,
      "",
      "Changes take effect on the next Sonderr start.",
    ])

  const handleApiPool = async () => {
    try {
      const cfg = await TuiConfig.get()
      const disabled = new Set(cfg.provider?.disabled_providers ?? [])
      const enabled = cfg.provider?.enabled_providers ? new Set(cfg.provider.enabled_providers) : undefined
      const configured = Object.entries(cfg.provider ?? {})
        .filter(([id]) => (enabled ? enabled.has(id) : true) && !disabled.has(id))
        .sort((a, b) => (a[1].name ?? a[0]).localeCompare(b[1].name ?? b[0]))
        .slice(0, 20)

      const lines = [
        "API pool for the swarm:",
        "",
        ...configured.map(([id, p]) => {
          const name = p.name ?? id
          const models = Object.keys(p.models ?? {}).length
          return `  ${name} (${id}) — ${models} model${models === 1 ? "" : "s"}`
        }),
        "",
        "To add an API, use /connect or add it to your sonderr.json config.",
        "Example:",
        '  { "provider": { "my-api": { "env": ["MY_API_KEY"], "api": "https://api.example.com/v1" } } }',
      ]
      alert("API Pool", lines)
    } catch (err) {
      alert("API Pool", ["Failed to load API pool.", "", String(err)])
    }
  }

  const handleSelect = (option: DialogSelectOption<string>) => {
    switch (option.value) {
      case "status":
        handleStatus()
        break
      case "swarm-agents":
        handleSwarmAgents()
        break
      case "tools":
        handleTools()
        break
      case "api-pool":
        handleApiPool()
        break
      case "config":
        handleConfig()
        break
    }
  }

  return (
    <DialogSelect
      title={`Hive ${state().enabled ? "(enabled)" : "(disabled)"}`}
      options={options()}
      flat
      onSelect={handleSelect}
    />
  )
}
