import { Effect, Stream } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { HttpServerResponse } from "effect/unstable/http"
import { InstanceHttpApi } from "@/server/routes/instance/httpapi/api"
import { AgentAssignment, HiveGuiApiError, HiveGuiSetup, ProviderPoolEntry, ProviderPoolEntryUpdate, RotationMode, TokenCap } from "@/server/routes/instance/httpapi/groups/hive-gui-setup"
import { Service as HiveGuiSetupService } from "@/sonderr/hive/gui-setup"

export const hiveGuiSetupHandlers = HttpApiBuilder.group(InstanceHttpApi, "hive-gui-setup", (handlers) =>
  Effect.gen(function* () {
    const svc = yield* HiveGuiSetupService

    const health = Effect.fn("HiveGuiSetupHttpApi.health")(() =>
      Effect.succeed({
        status: "ok" as const,
        version: "1",
        capabilities: ["pool", "assignments", "rotation", "token-cap"],
        timestamp: new Date().toISOString(),
      }),
    )

    const list = Effect.fn("HiveGuiSetupHttpApi.list")(() => svc.get())

    const replace = Effect.fn("HiveGuiSetupHttpApi.replace")((ctx: { payload: HiveGuiSetup }) =>
      svc.set(ctx.payload),
    )

    const pool = Effect.fn("HiveGuiSetupHttpApi.pool")((ctx: { payload: ProviderPoolEntry }) => {
      const setup = svc.get().pipe(
        Effect.map((s) => ({
          ...s,
          pool: [...s.pool, ctx.payload],
        })),
      )
      return svc.set(setup)
    })

    const poolDelete = Effect.fn("HiveGuiSetupHttpApi.poolDelete")((ctx: { params: { id: string } }) =>
      Effect.gen(function* () {
        const setup = yield* svc.get()
        const pool = setup.pool.filter((entry) => entry.id !== ctx.params.id)
        yield* svc.set({ ...setup, pool })
      }),
    )

    const poolUpdate = Effect.fn("HiveGuiSetupHttpApi.poolUpdate")((ctx: {
      params: { id: string }
      payload: ProviderPoolEntryUpdate
    }) =>
      Effect.gen(function* () {
        const setup = yield* svc.get()
        const pool = setup.pool.map((entry) =>
          entry.id === ctx.params.id ? { ...entry, ...ctx.payload } : entry,
        )
        yield* svc.set({ ...setup, pool })
        const updated = pool.find((entry) => entry.id === ctx.params.id)
        if (!updated) yield* new HiveGuiApiError({ name: "NotFound", data: { message: `Pool entry ${ctx.params.id} not found` } })
        return updated
      }),
    )

    const assignments = Effect.fn("HiveGuiSetupHttpApi.assignments")((ctx: { payload: AgentAssignment }) => {
      const setup = svc.get().pipe(
        Effect.map((s) => ({
          ...s,
          assignments: [...s.assignments, ctx.payload],
        })),
      )
      return svc.set(setup)
    })

    const assignmentsDelete = Effect.fn("HiveGuiSetupHttpApi.assignmentsDelete")((ctx: { params: { agent: string } }) =>
      Effect.gen(function* () {
        const setup = yield* svc.get()
        const assignments = setup.assignments.filter((entry) => entry.agent !== ctx.params.agent)
        yield* svc.set({ ...setup, assignments })
      }),
    )

    const rotation = Effect.fn("HiveGuiSetupHttpApi.rotation")((ctx: { payload: { mode: RotationMode } }) =>
      svc.update({ rotationMode: ctx.payload.mode }),
    )

    const tokenCap = Effect.fn("HiveGuiSetupHttpApi.tokenCap")((ctx: { payload: TokenCap }) =>
      svc.update({ globalTokenCap: ctx.payload }),
    )

    const sse = Effect.fn("HiveGuiSetupHttpApi.sse")(() =>
      Effect.gen(function* () {
        const encoder = new TextEncoder()
        const stream = Stream.fromAsyncGenerator(async function* () {
          while (true) {
            yield encoder.encode(`data: ${JSON.stringify({ timestamp: Date.now() })}\n\n`)
            await Bun.sleep(3000)
          }
        }())
        return HttpServerResponse.stream(stream, {
          contentType: "text/event-stream",
          headers: {
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        })
      }),
    )

    return handlers
      .handle("health", health)
      .handle("list", list)
      .handle("replace", replace)
      .handle("pool", pool)
      .handle("pool-delete", poolDelete)
      .handle("pool-update", poolUpdate)
      .handle("assignments", assignments)
      .handle("assignments-delete", assignmentsDelete)
      .handle("rotation", rotation)
      .handle("token-cap", tokenCap)
      .handle("sse", sse)
  }),
)
