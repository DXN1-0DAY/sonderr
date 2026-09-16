import path from "path"
import { Context, Effect, Layer, Schema } from "effect"
import { LayerNode } from "@sonderr/core/effect/layer-node"
import { FSUtil } from "@sonderr/core/fs-util"
import { Global } from "@sonderr/core/global"
import * as Log from "@sonderr/core/util/log"
import type { Info as AuthInfo } from "@/auth"

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const RotationMode = Schema.Literals(["round-robin", "random", "sticky", "failover"])
export type RotationMode = Schema.Schema.Type<typeof RotationMode>

export const TokenCap = Schema.Struct({
  maxInput: Schema.optional(Schema.Number).pipe(Schema.withDefault(() => 0)),
  maxOutput: Schema.optional(Schema.Number).pipe(Schema.withDefault(() => 0)),
  maxTotal: Schema.optional(Schema.Number).pipe(Schema.withDefault(() => 0)),
  warnAt: Schema.optional(Schema.Finite).pipe(Schema.withDefault(() => 0.8)),
}).annotate({ identifier: "HiveGuiTokenCap" })
export type TokenCap = Schema.Schema.Type<typeof TokenCap>

export const ProviderPoolEntry = Schema.Struct({
  id: Schema.String,
  providerID: Schema.String,
  modelID: Schema.String,
  auth: Schema.Struct({
    type: Schema.Literals(["api", "oauth", "wellknown"]),
    key: Schema.optional(Schema.String),
    refresh: Schema.optional(Schema.String),
    access: Schema.optional(Schema.String),
    expires: Schema.optional(Schema.Number),
    metadata: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  }),
  tokenCap: Schema.optional(TokenCap),
  weight: Schema.optional(Schema.PositiveNumber).pipe(Schema.withDefault(() => 1)),
  enabled: Schema.optional(Schema.Boolean).pipe(Schema.withDefault(() => true)),
  tags: Schema.optional(Schema.Array(Schema.String)).pipe(Schema.withDefault(() => [])),
}).annotate({ identifier: "HiveGuiProviderPoolEntry" })
export type ProviderPoolEntry = Schema.Schema.Type<typeof ProviderPoolEntry>

export const AgentAssignment = Schema.Struct({
  agent: Schema.String,
  poolEntryID: Schema.optional(Schema.String),
  override: Schema.optional(
    Schema.Struct({
      providerID: Schema.String,
      modelID: Schema.String,
      auth: Schema.Struct({
        type: Schema.Literals(["api", "oauth", "wellknown"]),
        key: Schema.optional(Schema.String),
        refresh: Schema.optional(Schema.String),
        access: Schema.optional(Schema.String),
        expires: Schema.optional(Schema.Number),
        metadata: Schema.optional(Schema.Record(Schema.String, Schema.String)),
      }),
    }),
  ),
  tokenCap: Schema.optional(TokenCap),
  tags: Schema.optional(Schema.Array(Schema.String)).pipe(Schema.withDefault(() => [])),
}).annotate({ identifier: "HiveGuiAgentAssignment" })
export type AgentAssignment = Schema.Schema.Type<typeof AgentAssignment>

export const HiveGuiSetup = Schema.Struct({
  version: Schema.optional(Schema.Literal(1)).pipe(Schema.withDefault(() => 1)),
  globalTokenCap: Schema.optional(TokenCap).pipe(Schema.withDefault(() => TokenCap.default)),
  rotationMode: Schema.optional(RotationMode).pipe(Schema.withDefault(() => "round-robin")),
  pool: Schema.Array(ProviderPoolEntry),
  assignments: Schema.Array(AgentAssignment),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
}).annotate({ identifier: "HiveGuiSetup" })
export type HiveGuiSetup = Schema.Schema.Type<typeof HiveGuiSetup>

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export interface Interface {
  readonly get: () => Effect.Effect<HiveGuiSetup>
  readonly set: (setup: HiveGuiSetup) => Effect.Effect<void>
  readonly update: (patch: Partial<HiveGuiSetup>) => Effect.Effect<HiveGuiSetup>
  readonly reset: () => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@sonderr/HiveGuiSetup") {}

const file = path.join(Global.Path.data, "storage", "hive-gui-setup.json")

const decode = Schema.decodeUnknownOption(HiveGuiSetup)

const read = (): Effect.Effect<HiveGuiSetup> =>
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const raw = yield* fs.readJson(file).pipe(
      Effect.catch(() => Effect.succeed({})),
    )
    const decoded = yield* decode(raw).pipe(
      Effect.catch((err) =>
        Effect.sync(() => {
          Log.error("hive-gui-setup decode failed", { err })
          return HiveGuiSetup.default
        }),
      ),
    )
    return decoded
  })

const write = (data: HiveGuiSetup): Effect.Effect<void> =>
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const dir = path.dirname(file)
    yield* fs.ensureDir(dir).pipe(Effect.catch(() => Effect.void))
    yield* fs.writeJson(file, data, 0o600).pipe(
      Effect.catch((err) => Effect.sync(() => Log.error("hive-gui-setup write failed", { err }))),
    )
  })

const now = () => Date.now()

export const node = LayerNode.make({
  service: Service,
  layer: Layer.effect(
    Service,
    Effect.gen(function* () {
      const fs = yield* FSUtil.Service
      const global = yield* Global.Service

      const get = Effect.fn("HiveGuiSetup.get")(() => read())
      const set = Effect.fn("HiveGuiSetup.set")((setup: HiveGuiSetup) =>
        write({ ...setup, updatedAt: now() }),
      )
      const update = Effect.fn("HiveGuiSetup.update")((patch: Partial<HiveGuiSetup>) =>
        Effect.gen(function* () {
          const current = yield* get()
          const next = { ...current, ...patch, updatedAt: now() }
          yield* write(next)
          return next
        }),
      )
      const reset = Effect.fn("HiveGuiSetup.reset")(() =>
        Effect.gen(function* () {
          const dir = path.dirname(file)
          yield* fs.remove(dir).pipe(Effect.catch(() => Effect.void))
        }),
      )

      return Service.of({ get, set, update, reset })
    }),
  ),
  deps: [FSUtil.node, Global.node],
})

export const defaultLayer = node.layer.pipe(Layer.provide(FSUtil.defaultLayer))
