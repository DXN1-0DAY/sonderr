/** @jsxImportSource @opentui/solid */
import { useSync } from "../../context/sync"
import { useTheme } from "../../context/theme"
import { useRenderer } from "@opentui/solid"
import { createMemo, createSignal, For, Show, onMount, onCleanup } from "solid-js"
import { usePluginRuntime } from "../../plugin/runtime"
import { InstallationVersion } from "@sonderr/core/installation/version"

const ORANGE = "#ff8800"
const ORANGE_DARK = "#cc5500"
const ORANGE_LIGHT = "#ffaa33"
const ORANGE_BG = "#331100"
const GREEN = "#00ff88"
const RED = "#ff4444"

const SPINNER_CHARS = ["◐", "◓", "◑", "◒"]
const WAVE_FRAMES = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█", "▇", "▆", "▅", "▄", "▃", "▂"]
const DOT_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
const PULSE_FRAMES = ["○", "◔", "◑", "◕", "●", "◕", "◑", "◔"]
const BOOT_FRAMES = [
  "[     ]",
  "[=    ]",
  "[>=   ]",
  "[=>   ]",
  "[=>=  ]",
  "[=>=> ]",
  "[[DONE]]",
] as const

const SWARM_AGENTS = [
  { name: "researcher", role: "Research", icon: "🔍" },
  { name: "coder", role: "Implementation", icon: "⚙️" },
  { name: "reviewer", role: "Quality", icon: "🔎" },
  { name: "tester", role: "Testing", icon: "🧪" },
  { name: "documenter", role: "Docs", icon: "📝" },
  { name: "debugger", role: "Debugging", icon: "🐛" },
  { name: "architect", role: "Design", icon: "🏗️" },
] as const

const ASCII_HIVE = `
██╗  ██╗ ██████╗ ██╗   ██╗███████╗██████╗ 
██║  ██║██╔═══██╗██║   ██║██╔════╝██╔══██╗
███████║██║   ██║██║   ██║█████╗  ██████╔╝
██╔══██║██║   ██║╚██╗ ██╔╝██╔══╝  ██╔══██╗
██║  ██║╚██████╔╝ ╚████╔╝ ███████╗██║  ██║
╚═╝  ╚═╝ ╚═════╝   ╚═══╝  ╚══════╝╚═╝  ╚═╝`.trim()

function Spinner() {
  const [tick, setTick] = createSignal(0)
  onMount(() => {
    const timer = setInterval(() => setTick((t) => (t + 1) % SPINNER_CHARS.length), 100)
    onCleanup(() => clearInterval(timer))
  })
  return <text fg={ORANGE_LIGHT}>{SPINNER_CHARS[tick()]}</text>
}

function AnimatedWave() {
  const [tick, setTick] = createSignal(0)
  onMount(() => {
    const timer = setInterval(() => setTick((t) => (t + 1) % WAVE_FRAMES.length), 120)
    onCleanup(() => clearInterval(timer))
  })
  const frame = () => {
    const t = tick()
    const chars: string[] = []
    for (let i = 0; i < 6; i++) chars.push(WAVE_FRAMES[(t + i) % WAVE_FRAMES.length])
    return chars.join("")
  }
  return <text fg={ORANGE}>{frame()}</text>
}

function AnimatedDots() {
  const [tick, setTick] = createSignal(0)
  onMount(() => {
    const timer = setInterval(() => setTick((t) => (t + 1) % DOT_FRAMES.length), 80)
    onCleanup(() => clearInterval(timer))
  })
  return <text fg={ORANGE_LIGHT}>{DOT_FRAMES[tick()]}</text>
}

function AnimatedPulse() {
  const [tick, setTick] = createSignal(0)
  onMount(() => {
    const timer = setInterval(() => setTick((t) => (t + 1) % PULSE_FRAMES.length), 150)
    onCleanup(() => clearInterval(timer))
  })
  return <text fg={ORANGE}>{PULSE_FRAMES[tick()]}</text>
}

function BootSequence() {
  const [frame, setFrame] = createSignal(0)
  onMount(() => {
    const timer = setInterval(() => setFrame((f) => Math.min(f + 1, BOOT_FRAMES.length - 1)), 120)
    onCleanup(() => clearInterval(timer))
  })
  return (
    <box paddingBottom={1}>
      <text fg={ORANGE_LIGHT}>
        Initializing swarm{frame() < BOOT_FRAMES.length - 1 ? "..." : ""}
      </text>
      <text fg={frame() === BOOT_FRAMES.length - 1 ? GREEN : ORANGE}>
        {BOOT_FRAMES[frame()]}
      </text>
    </box>
  )
}

function ProgressBar(props: { width: number; color: string }) {
  const [offset, setOffset] = createSignal(0)
  onMount(() => {
    const timer = setInterval(() => setOffset((o) => (o + 1) % props.width), 100)
    onCleanup(() => clearInterval(timer))
  })
  const block = "█"
  const space = "░"
  return (
    <text fg={props.color}>
      {Array.from({ length: props.width }, (_, i) => {
        const dist = Math.abs(i - offset())
        return dist < 3 ? block : space
      }).join("")}
    </text>
  )
}

function VoteBar(props: { yes: number; no: number; abstain: number; width: number }) {
  const total = props.yes + props.no + props.abstain
  if (total === 0) return <text fg={ORANGE_DARK}>No votes yet</text>

  const yesWidth = Math.round((props.yes / total) * props.width)
  const noWidth = Math.round((props.no / total) * props.width)
  const abstainWidth = props.width - yesWidth - noWidth

  const bar = []
  for (let i = 0; i < yesWidth; i++) bar.push(<text fg={GREEN}>█</text>)
  for (let i = 0; i < noWidth; i++) bar.push(<text fg={RED}>█</text>)
  for (let i = 0; i < abstainWidth; i++) bar.push(<text fg={ORANGE_DARK}>█</text>)

  return (
    <box flexDirection="row" gap={0}>
      {bar}
    </box>
  )
}

export function HiveSidebar(props: { sessionID: string; overlay?: boolean }) {
  const sync = useSync()
  const { theme } = useTheme()
  const renderer = useRenderer()
  const pluginRuntime = usePluginRuntime()
  const session = createMemo(() => sync.session.get(props.sessionID))

  const sessionStatus = createMemo(() => sync.data.session_status[props.sessionID] as { type: string } | undefined)
  const isWorking = createMemo(() => sessionStatus()?.type === "busy")

  const [tick, setTick] = createSignal(0)
  const [asciiPhase, setAsciiPhase] = createSignal(0)
  const [bootComplete, setBootComplete] = createSignal(false)
  const [switchPhase, setSwitchPhase] = createSignal(0)
  onMount(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1)
      renderer.requestRender()
    }, 50)
    const asciiTimer = setInterval(() => {
      setAsciiPhase((p) => (p + 1) % 4)
    }, 3000)
    const switchTimer = setInterval(() => {
      setSwitchPhase((p) => Math.min(p + 0.08, 1))
    }, 50)
    setTimeout(() => setBootComplete(true), BOOT_FRAMES.length * 120 + 200)
    onCleanup(() => {
      clearInterval(timer)
      clearInterval(asciiTimer)
      clearInterval(switchTimer)
    })
  })

  const elapsed = createMemo(() => {
    if (!isWorking()) return 0
    return Date.now() - (session()?.time?.updated ?? Date.now())
  })

  const formatElapsed = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  const agentName = createMemo(() => session()?.agent ?? "hive")
  const isSwarmWorker = createMemo(() => agentName() !== "hive" && SWARM_AGENTS.some((a) => a.name === agentName()))
  const currentAgent = createMemo(() => SWARM_AGENTS.find((a) => a.name === agentName()))

  const todos = createMemo(() => sync.data.todo[props.sessionID] ?? [])
  const pendingTodos = createMemo(() => todos().filter((t: any) => t.status === "pending" || t.status === "in_progress"))
  const completedTodos = createMemo(() => todos().filter((t: any) => t.status === "completed"))

  const proposals = createMemo(() => (sync.data as any).hive_proposals?.[props.sessionID] ?? [])
  const activeProposals = createMemo(() => proposals().filter((p: any) => p.status === "open"))

  const asciiColor = createMemo(() => {
    if (!isWorking()) return ORANGE_LIGHT
    const phases = [ORANGE_LIGHT, ORANGE, ORANGE_DARK, ORANGE_LIGHT]
    return phases[asciiPhase()]
  })

  const revealProgress = createMemo(() => Math.min(switchPhase() / 0.4, 1))

  return (
    <Show when={session()}>
      <box
        backgroundColor={ORANGE_BG}
        width={42}
        height="100%"
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={2}
        paddingRight={2}
        position={props.overlay ? "absolute" : "relative"}
      >
        <scrollbox flexGrow={1} verticalScrollbarOptions={{
          trackOptions: { backgroundColor: ORANGE_DARK, foregroundColor: ORANGE_LIGHT },
        }}>
          <box flexShrink={0} gap={1} paddingRight={1}>
            {/* Boot sequence or ASCII HIVE Header */}
            <Show when={!bootComplete()} fallback={
              <box paddingBottom={1}>
                <text fg={asciiColor()}>
                  {ASCII_HIVE.split("\n").map((line, i) => (
                    <span style={{ fg: i === 0 ? ORANGE_LIGHT : ORANGE }}>{line}</span>
                  ))}
                </text>
              </box>
            }>
              <BootSequence />
            </Show>

            {/* Hive mode activated flash */}
            <Show when={bootComplete() && switchPhase() < 0.3}>
              <box paddingBottom={1} paddingTop={1}>
                <text fg={ORANGE_LIGHT}>
                  <b>⚡ HIVE MODE ACTIVATED ⚡</b>
                </text>
              </box>
            </Show>

            {/* Agent info - with reveal animation */}
            <Show when={bootComplete()}>
              <box paddingBottom={1} flexDirection="row" gap={1} style={{
                opacity: revealProgress(),
              }}>
                <text fg={ORANGE_LIGHT}>
                  <b>Agent:</b> {agentName()}
                </text>
                <Show when={isSwarmWorker() && currentAgent()}>
                  <text fg={ORANGE}>{currentAgent()!.icon} {currentAgent()!.role}</text>
                </Show>
              </box>

              {/* Working indicator */}
              <Show when={isWorking()}>
                <box gap={1} paddingBottom={1} style={{
                  opacity: revealProgress(),
                }}>
                  <box flexDirection="row" gap={1} alignItems="center">
                    <Spinner />
                    <text fg={ORANGE_LIGHT}>
                      <b>SWARM ACTIVE</b>
                    </text>
                    <AnimatedDots />
                  </box>
                  <AnimatedWave />
                  <box flexDirection="row" gap={1} alignItems="center">
                    <AnimatedPulse />
                    <text fg={ORANGE}>Elapsed: {formatElapsed(elapsed())}</text>
                  </box>
                  <ProgressBar width={36} color={ORANGE_LIGHT} />
                </box>
              </Show>

              {/* Swarm agents */}
              <box paddingBottom={1} paddingTop={1} style={{
                opacity: revealProgress(),
              }}>
                <text fg={ORANGE}>
                  <b>Swarm Agents</b>
                </text>
                <box paddingLeft={1} paddingTop={1} gap={0}>
                  <For each={SWARM_AGENTS}>
                    {(agent) => (
                      <box flexDirection="row" gap={1}>
                        <text fg={agent.name === agentName() ? ORANGE_LIGHT : ORANGE}>
                          {agent.name === agentName() ? "▸" : " "} {agent.icon} {agent.name}
                        </text>
                      </box>
                    )}
                  </For>
                </box>
              </box>

              {/* Active proposals */}
              <box paddingTop={1} style={{
                opacity: revealProgress(),
              }}>
                <text fg={ORANGE}>
                  <b>Proposals ({activeProposals().length})</b>
                </text>
                <Show when={activeProposals().length > 0}>
                  <box paddingLeft={1} paddingTop={1} gap={1}>
                    <For each={activeProposals().slice(0, 5)}>
                      {(proposal: any) => {
                        const votes = proposal.votes || {}
                        const yesCount = Object.values(votes as Record<string, string>).filter((v: any) => v === "yes").length
                        const noCount = Object.values(votes as Record<string, string>).filter((v: any) => v === "no").length
                        const abstainCount = Object.values(votes as Record<string, string>).filter((v: any) => v === "abstain").length
                        const total = yesCount + noCount + abstainCount
                        return (
                          <box flexShrink={0} gap={0} paddingBottom={1}>
                            <text fg={ORANGE_LIGHT}>{proposal.title?.slice(0, 22) ?? "Untitled"}</text>
                            <VoteBar yes={yesCount} no={noCount} abstain={abstainCount} width={30} />
                            <text fg={ORANGE_DARK}>
                              {total} vote{total !== 1 ? "s" : ""} (✓{yesCount} ✗{noCount} ⊘{abstainCount})
                            </text>
                          </box>
                        )
                      }}
                    </For>
                  </box>
                </Show>
                <Show when={proposals().length === 0}>
                  <box paddingLeft={1} paddingTop={1}>
                    <text fg={ORANGE_DARK}>No active proposals</text>
                  </box>
                </Show>
              </box>

              {/* Todos */}
              <box paddingTop={1} style={{
                opacity: revealProgress(),
              }}>
                <text fg={ORANGE}>
                  <b>Todos ({pendingTodos().length + completedTodos().length})</b>
                </text>
                <Show when={pendingTodos().length > 0}>
                  <box paddingLeft={1} paddingTop={1} gap={0}>
                    <For each={pendingTodos().slice(0, 8)}>
                      {(todo: any) => (
                        <box flexDirection="row" gap={1}>
                          <text fg={ORANGE_LIGHT}>◻</text>
                          <text fg={ORANGE}>{todo.content?.slice(0, 18) ?? "Untitled"}</text>
                        </box>
                      )}
                    </For>
                  </box>
                </Show>
                <Show when={completedTodos().length > 0}>
                  <box paddingLeft={1} paddingTop={1} gap={0}>
                    <For each={completedTodos().slice(0, 5)}>
                      {(todo: any) => (
                        <box flexDirection="row" gap={1}>
                          <text fg={ORANGE_DARK}>✓</text>
                          <text fg={ORANGE_DARK}>{todo.content?.slice(0, 18) ?? "Untitled"}</text>
                        </box>
                      )}
                    </For>
                  </box>
                </Show>
                <Show when={todos().length === 0}>
                  <box paddingLeft={1} paddingTop={1}>
                    <text fg={ORANGE_DARK}>No todos yet</text>
                  </box>
                </Show>
              </box>

              {/* Session title */}
              <pluginRuntime.Slot
                name="sidebar_title"
                mode="single_winner"
                session_id={props.sessionID}
                title={session()!.title}
                share_url={session()!.share?.url}
              >
                <box paddingTop={1} paddingRight={1} style={{
                  opacity: revealProgress(),
                }}>
                  <text fg={ORANGE_LIGHT}>
                    <b>{session()!.title}</b>
                  </text>
                </box>
              </pluginRuntime.Slot>

              <pluginRuntime.Slot name="sidebar_content" session_id={props.sessionID} />
            </Show>
          </box>
        </scrollbox>

        <box flexShrink={0} gap={1} paddingTop={1}>
          <pluginRuntime.Slot name="sidebar_footer" mode="single_winner" session_id={props.sessionID}>
            <text fg={ORANGE_DARK}>
              sonderr -- version -- {InstallationVersion}
            </text>
          </pluginRuntime.Slot>
        </box>
      </box>
    </Show>
  )
}
