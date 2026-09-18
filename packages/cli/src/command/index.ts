import { LayerNode } from "@sonderr/core/effect/layer-node"
import { InstanceState } from "@/effect/instance-state"
import { EffectBridge } from "@/effect/bridge"
import type { InstanceContext } from "@/project/instance-context"
import { Effect, Layer, Context, Schema } from "effect"
import { Config } from "@/config/config"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { MCP } from "../mcp"
import { Skill } from "../skill"
import { legacyReviewCommand, reviewCommand } from "@/sonderr/review/command" // sonderr_change
import { apply as applyOverride, type Override } from "@/sonderr/command/override" // sonderr_change
import PROMPT_INITIALIZE from "./template/initialize.txt"
import { LegacyEvent } from "@sonderr/schema/legacy-event"
import { SessionResume } from "@/sonderr/session-resume" // sonderr_change

type State = {
  commands: Record<string, Info>
}

export const Event = {
  Executed: LegacyEvent.CommandExecuted,
}

export const Info = Schema.Struct({
  name: Schema.String,
  description: Schema.optional(Schema.String),
  agent: Schema.optional(Schema.String),
  model: Schema.optional(Schema.String),
  variant: Schema.optional(Schema.String), // sonderr_change
  source: Schema.optional(Schema.Literals(["command", "mcp", "skill"])),
  trusted: Schema.optional(Schema.Boolean), // sonderr_change - skill-sourced templates only run `!`cmd`` shell when trusted
  // Some command templates are lazy promises from MCP prompt resolution.
  template: Schema.Unknown,
  subtask: Schema.optional(Schema.Boolean),
  hints: Schema.Array(Schema.String),
}).annotate({ identifier: "Command" })

export type Info = Omit<Schema.Schema.Type<typeof Info>, "template"> & { template: Promise<string> | string }

export function hints(template: string) {
  const result: string[] = []
  const numbered = template.match(/\$\d+/g)
  if (numbered) {
    for (const match of [...new Set(numbered)].sort()) result.push(match)
  }
  if (template.includes("$ARGUMENTS")) result.push("$ARGUMENTS")
  return result
}

export const Default = {
  INIT: "init",
  REVIEW: "review",
} as const

export interface Interface {
  readonly get: (name: string) => Effect.Effect<Info | undefined>
  readonly list: () => Effect.Effect<Info[]>
}

// sonderr_change start - skills are loaded via the `skill` tool, not slash commands
function mcpName(name: string) {
  return name.endsWith(":mcp") ? name.slice(0, -4) : undefined
}
// sonderr_change end

export class Service extends Context.Service<Service, Interface>()("@sonderr/Command") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const config = yield* Config.Service
    const mcp = yield* MCP.Service
    const skill = yield* Skill.Service

    const init = Effect.fn("Command.state")(function* (ctx: InstanceContext) {
      const cfg = yield* config.get()
      const bridge = yield* EffectBridge.make()
      const commands: Record<string, Info> = {}

      commands[Default.INIT] = {
        name: Default.INIT,
        description: "guided AGENTS.md setup",
        source: "command",
        get template() {
          return PROMPT_INITIALIZE.replace("${path}", ctx.worktree)
        },
        hints: hints(PROMPT_INITIALIZE),
      }
      // sonderr_change start
      commands[Default.REVIEW] = reviewCommand()
      commands["resume-claude"] = SessionResume.resumeClaude
      commands["resume-codex"] = SessionResume.resumeCodex
      commands["mcp"] = {
        name: "mcp",
        description: "list and manage MCP servers",
        source: "command",
        get template() {
          return bridge.promise(
            Effect.gen(function* () {
              const cfg = yield* config.get()
              const mcpService = yield* MCP.Service
              const clients = yield* mcpService.clients()
              const tools = yield* mcpService.tools()
              const lines: string[] = []
              lines.push("# MCP Servers")
              lines.push("")
              const entries = Object.entries(cfg.mcp ?? {})
              if (!entries.length) {
                lines.push("No MCP servers configured.")
                return lines.join("\n")
              }
               for (const [name, server] of entries) {
                 const enabled = clients[name] !== undefined
                 lines.push(`## ${name}`)
                 lines.push(`- Status: ${enabled ? "connected" : "disabled"}`)
                 if ("type" in server) {
                   const type = server.type
                   lines.push(`- Type: ${type}`)
                   if (type === "local" && Array.isArray(server.command)) {
                     lines.push(`- Command: ${server.command.join(" ")}`)
                   }
                   if (type === "remote" && server.url) {
                     lines.push(`- URL: ${server.url}`)
                   }
                 }
                 const serverTools = Object.entries(tools).filter(([toolName]) => toolName.startsWith(`${name}_`))
                 if (serverTools.length) {
                   lines.push("- Tools:")
                   for (const [toolName, tool] of serverTools) {
                     lines.push(`  - ${toolName}: ${tool.def.description}`)
                   }
                 }
                 lines.push("")
               }
              return lines.join("\n")
            }),
          )
        },
        hints: [],
      }

      // sonderr_change start - defer partial overrides until all command sources are registered
      const overrides: Array<{ name: string; command: Override }> = []
      for (const [name, command] of Object.entries(cfg.command ?? {})) {
        if (!applyOverride(commands, name, command, hints)) overrides.push({ name, command }) // sonderr_change
      }
      // sonderr_change end

      for (const [name, prompt] of Object.entries(yield* mcp.prompts())) {
        commands[name] = {
          name,
          source: "mcp",
          description: prompt.description,
          get template() {
            return bridge.promise(
              mcp
                .getPrompt(
                  prompt.client,
                  prompt.name,
                  prompt.arguments
                    ? Object.fromEntries(prompt.arguments.map((argument, i) => [argument.name, `$${i + 1}`]))
                    : {},
                )
                .pipe(
                  Effect.map(
                    (template) =>
                      template?.messages
                        .map((message) => (message.content.type === "text" ? message.content.text : ""))
                        .join("\n") || "",
                  ),
                ),
            )
          },
          hints: prompt.arguments?.map((_, i) => `$${i + 1}`) ?? [],
        }
      }

      for (const item of overrides) {
        const prompt = mcpName(item.name)
        if (prompt) {
          applyOverride(commands, prompt, item.command, hints) // sonderr_change
          continue
        }
        applyOverride(commands, item.name, item.command, hints) // sonderr_change
      }

      commands["skills"] = {
        name: "skills",
        description: "list available skills",
        source: "command",
        get template() {
          return bridge.promise(
            Skill.Service.pipe(
              Effect.flatMap((skill) => skill.all()),
              Effect.map((items) =>
                items
                  .map(
                    (item) =>
                      `- ${item.name}${item.trusted === true ? " (trusted)" : ""}: ${item.description ?? "no description"}`,
                  )
                  .join("\n") || "No skills available.",
              ),
            ),
          )
        },
        hints: [],
      }

      return {
        commands,
      }
    })

    const state = yield* InstanceState.make<State>((ctx) => init(ctx))

    const get = Effect.fn("Command.get")(function* (name: string) {
      const s = yield* InstanceState.get(state)
      const exact = s.commands[name] // sonderr_change
      if (exact) return exact // sonderr_change
      const alias = legacyReviewCommand(name) // sonderr_change
      if (alias) return alias // sonderr_change

      // sonderr_change start
      const prompt = mcpName(name)
      if (prompt) {
        const cmd = s.commands[prompt]
        return cmd?.source === "mcp" ? cmd : undefined
      }
      // sonderr_change end
      return undefined // sonderr_change
    })

    const list = Effect.fn("Command.list")(function* () {
      const s = yield* InstanceState.get(state)
      return Object.values(s.commands)
    })

    return Service.of({ get, list })
  }),
)

export const node = LayerNode.make({ service: Service, layer: layer, deps: [Config.node, MCP.node, Skill.node] })

export * as Command from "."
