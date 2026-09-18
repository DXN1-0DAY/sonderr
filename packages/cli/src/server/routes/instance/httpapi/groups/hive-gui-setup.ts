import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { Authorization } from "../middleware/authorization"
import { InstanceContextMiddleware } from "../middleware/instance-context"
import { WorkspaceRoutingMiddleware } from "../middleware/workspace-routing"
import { HiveGuiSetup, ProviderPoolEntry, AgentAssignment, TokenCap, RotationMode } from "@/sonderr/hive/gui-setup"

const root = "/hive-gui-setup"

const ApiError = Schema.Union([
  Schema.Literal("BadRequest"),
  Schema.Literal("NotFound"),
  Schema.Literal("Conflict"),
  Schema.Literal("Internal"),
])

export class HiveGuiApiError extends Schema.TaggedErrorClass<HiveGuiApiError>()("HiveGuiApiError", {
  name: ApiError,
  data: Schema.Struct({
    message: Schema.optional(Schema.String),
  }),
}) {}

const ProviderPoolEntryUpdate = Schema.Struct({
  id: Schema.optional(Schema.String),
  providerID: Schema.optional(Schema.String),
  modelID: Schema.optional(Schema.String),
  auth: Schema.optional(
    Schema.Struct({
      type: Schema.Literals(["api", "oauth", "wellknown"]),
      key: Schema.optional(Schema.String),
      refresh: Schema.optional(Schema.String),
      access: Schema.optional(Schema.String),
      expires: Schema.optional(Schema.Number),
      metadata: Schema.optional(Schema.Record(Schema.String, Schema.String)),
    }),
  ),
  tokenCap: Schema.optional(TokenCap),
  weight: Schema.optional(Schema.Number),
  enabled: Schema.optional(Schema.Boolean),
  tags: Schema.optional(Schema.Array(Schema.String)),
}).annotate({ identifier: "HiveGuiProviderPoolEntryUpdate" })

export const HiveGuiSetupApi = HttpApi.make("hive-gui-setup")
  .add(
    HttpApiGroup.make("hive-gui-setup")
      .add(
        HttpApiEndpoint.get("health", `${root}/health`, {
          success: Schema.Struct({
            status: Schema.Literal("ok"),
            version: Schema.String,
            capabilities: Schema.Array(Schema.String),
            timestamp: Schema.String,
          }),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "hive-gui-setup.health",
            summary: "Health check",
            description: "Lightweight liveness check for the hive GUI setup service.",
          }),
        ),
        HttpApiEndpoint.get("list", `${root}/list`, {
          success: HiveGuiSetup,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "hive-gui-setup.list",
            summary: "Get hive GUI setup",
            description: "Returns the current hive GUI setup state including pool and assignments.",
          }),
        ),
        HttpApiEndpoint.put("replace", root, {
          payload: HiveGuiSetup,
          success: HiveGuiSetup,
          error: HiveGuiApiError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "hive-gui-setup.replace",
            summary: "Replace hive GUI setup",
            description: "Replaces the entire hive GUI setup state.",
          }),
        ),
        HttpApiEndpoint.post("pool", `${root}/pool`, {
          payload: ProviderPoolEntry,
          success: ProviderPoolEntry,
          error: HiveGuiApiError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "hive-gui-setup.pool.add",
            summary: "Add provider to pool",
            description: "Adds a new provider pool entry.",
          }),
        ),
        HttpApiEndpoint.delete("pool-delete", `${root}/pool/:id`, {
          params: Schema.Struct({ id: Schema.String }),
          success: Schema.Void,
          error: HiveGuiApiError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "hive-gui-setup.pool.delete",
            summary: "Remove provider from pool",
            description: "Removes a provider pool entry by ID.",
          }),
        ),
        HttpApiEndpoint.put("pool-update", `${root}/pool/:id`, {
          params: Schema.Struct({ id: Schema.String }),
          payload: ProviderPoolEntryUpdate,
          success: ProviderPoolEntry,
          error: HiveGuiApiError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "hive-gui-setup.pool.update",
            summary: "Update provider in pool",
            description: "Updates a provider pool entry by ID.",
          }),
        ),
        HttpApiEndpoint.post("assignments", `${root}/assignments`, {
          payload: AgentAssignment,
          success: AgentAssignment,
          error: HiveGuiApiError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "hive-gui-setup.assignments.add",
            summary: "Add agent assignment",
            description: "Adds or updates an agent assignment.",
          }),
        ),
        HttpApiEndpoint.delete("assignments-delete", `${root}/assignments/:agent`, {
          params: Schema.Struct({ agent: Schema.String }),
          success: Schema.Void,
          error: HiveGuiApiError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "hive-gui-setup.assignments.delete",
            summary: "Remove agent assignment",
            description: "Removes an agent assignment by agent name.",
          }),
        ),
        HttpApiEndpoint.put("rotation", `${root}/rotation`, {
          payload: Schema.Struct({ mode: RotationMode }),
          success: Schema.Struct({ rotationMode: RotationMode }),
          error: HiveGuiApiError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "hive-gui-setup.rotation.update",
            summary: "Update rotation mode",
            description: "Updates the global rotation mode.",
          }),
        ),
        HttpApiEndpoint.put("token-cap", `${root}/token-cap`, {
          payload: TokenCap,
          success: TokenCap,
          error: HiveGuiApiError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "hive-gui-setup.token-cap.update",
            summary: "Update global token cap",
            description: "Updates the global token cap applied to all agents and pool entries.",
          }),
        ),
        HttpApiEndpoint.get("sse", `${root}/sse`, {
          success: Schema.String.pipe(HttpApiSchema.asText({ contentType: "text/event-stream" })),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "hive-gui-setup.sse",
            summary: "Hive GUI setup SSE stream",
            description: "Server-sent events stream for hive GUI setup changes.",
          }),
        ),
      )
      .middleware(InstanceContextMiddleware)
      .middleware(WorkspaceRoutingMiddleware)
      .middleware(Authorization),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "hive-gui-setup",
      description: "Hive GUI setup HTTP API for managing API pools, agent assignments, and rotation modes.",
    }),
  )
