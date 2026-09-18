import { Schema } from "effect"
import { HttpApi } from "effect/unstable/httpapi"
import { EventV2 } from "@sonderr/core/event"
import { EventManifest } from "@/event-manifest"
import { Credential } from "@sonderr/core/credential"
import { Integration } from "@sonderr/core/integration"
import { SkillV2 } from "@sonderr/core/skill"
import { InstanceDisposed } from "@/server/event"
import { Question } from "@/question"
import { BusEvent } from "@/bus/bus-event" // sonderr_change - include legacy Sonderr events until they migrate to EventV2
import { ConfigApi } from "./groups/config"
import { ControlApi } from "./groups/control"
import { ControlPlaneApi } from "./groups/control-plane"
import { EventApi } from "./groups/event"
import { ExperimentalApi } from "./groups/experimental"
import { FileApi } from "./groups/file"
import { InstanceApi } from "./groups/instance"
import { McpApi } from "./groups/mcp"
import { PermissionApi } from "./groups/permission"
import { ProjectApi } from "./groups/project"
import { ProjectCopyApi } from "./groups/project-copy"
import { ProviderApi } from "./groups/provider"
import { PtyApi, PtyConnectApi } from "./groups/pty"
import { QuestionApi } from "./groups/question"
import { SessionApi } from "./groups/session"
import { SyncApi } from "./groups/sync"
import { TuiApi } from "./groups/tui"
import { WorkspaceApi } from "./groups/workspace"
// sonderr_change start - Sonderr HttpApi groups
import { AgentBuilderApi } from "@/sonderr/server/httpapi/groups/agent-builder"
import { BranchNameApi } from "@/sonderr/server/httpapi/groups/branch-name"
import { CommitMessageApi } from "@/sonderr/server/httpapi/groups/commit-message"
import { BackgroundProcessApi } from "@/sonderr/server/httpapi/groups/background-process"
import { ConfigConsoleApi } from "@/sonderr/server/httpapi/groups/config-console"
import { EnhancePromptApi } from "@/sonderr/server/httpapi/groups/enhance-prompt"
import { IndexingApi } from "@/sonderr/server/httpapi/groups/indexing"
import { InstanceReloadApi } from "@/sonderr/server/httpapi/groups/instance-reload"
import { InteractiveTerminalApi } from "@/sonderr/server/httpapi/groups/interactive-terminal"
import { SonderrGatewayApi } from "@/sonderr/server/httpapi/groups/sonderr-gateway"
import { SonderrApi } from "@/sonderr/server/httpapi/groups/sonderr"
import { NetworkApi } from "@/sonderr/server/httpapi/groups/network"
import { RemoteApi } from "@/sonderr/server/httpapi/groups/remote"
import { SandboxApi } from "@/sonderr/server/httpapi/groups/sandbox"
import { SessionImportApi } from "@/sonderr/server/httpapi/groups/session-import"
import { SuggestionApi } from "@/sonderr/server/httpapi/groups/suggestion"
import { TelemetryApi } from "@/sonderr/server/httpapi/groups/telemetry"
import { MemoryApi } from "@/sonderr/server/httpapi/groups/memory" // sonderr_change
import { HiveGuiSetupApi } from "@/server/routes/instance/httpapi/groups/hive-gui-setup"
// sonderr_change end
import { makeApi } from "@sonderr/protocol/api"
import { LocationMiddleware } from "@sonderr/server/location"
import { SessionLocationMiddleware } from "@sonderr/server/middleware/session-location"
import { GlobalApi } from "./groups/global"
import { Authorization } from "./middleware/authorization"
import { SchemaErrorMiddleware } from "./middleware/schema-error"

const EventSchema = Schema.Union([
  ...EventManifest.Latest.values()
    .map((definition) =>
      Schema.Struct({
        id: EventV2.ID,
        type: Schema.Literal(definition.type),
        properties: definition.data,
      }).annotate({ identifier: `Event.${definition.type}` }),
    )
    .toArray(),
  ...BusEvent.effectPayloads(), // sonderr_change - include legacy Sonderr events until they migrate to EventV2
  InstanceDisposed,
]).annotate({ identifier: "Event" })

export const ServerApi = makeApi({
  definitions: EventManifest.Latest.values().toArray(),
  locationMiddleware: LocationMiddleware,
  sessionLocationMiddleware: SessionLocationMiddleware,
})

export const RootHttpApi = HttpApi.make("sonderr-root")
  .addHttpApi(ControlApi)
  .addHttpApi(ControlPlaneApi)
  .addHttpApi(GlobalApi)
  .middleware(SchemaErrorMiddleware)
  .middleware(Authorization)

export const InstanceHttpApi = HttpApi.make("sonderr-instance")
  .addHttpApi(ConfigApi)
  .addHttpApi(ExperimentalApi)
  .addHttpApi(FileApi)
  .addHttpApi(InstanceApi)
  .addHttpApi(McpApi)
  .addHttpApi(ProjectApi)
  .addHttpApi(ProjectCopyApi)
  .addHttpApi(PtyApi)
  .addHttpApi(QuestionApi)
  .addHttpApi(PermissionApi)
  .addHttpApi(ProviderApi)
  .addHttpApi(SessionApi)
  .addHttpApi(SyncApi)
  .addHttpApi(TuiApi)
  .addHttpApi(WorkspaceApi)
  // sonderr_change start - Sonderr HttpApi groups
  .addHttpApi(AgentBuilderApi)
  .addHttpApi(BackgroundProcessApi)
  .addHttpApi(BranchNameApi)
  .addHttpApi(CommitMessageApi)
  .addHttpApi(ConfigConsoleApi)
  .addHttpApi(EnhancePromptApi)
  .addHttpApi(IndexingApi)
  .addHttpApi(InstanceReloadApi)
  .addHttpApi(InteractiveTerminalApi)
  .addHttpApi(SonderrGatewayApi)
  .addHttpApi(SonderrApi)
  .addHttpApi(NetworkApi)
  .addHttpApi(RemoteApi)
  .addHttpApi(SandboxApi)
  .addHttpApi(SessionImportApi)
  .addHttpApi(SuggestionApi)
  .addHttpApi(TelemetryApi)
  .addHttpApi(MemoryApi)
  .addHttpApi(HiveGuiSetupApi)
  // sonderr_change end
  .middleware(SchemaErrorMiddleware)

export const SonderrHttpApi = HttpApi.make("sonderr")
  .addHttpApi(RootHttpApi)
  .addHttpApi(EventApi)
  .addHttpApi(InstanceHttpApi)
  .addHttpApi(ServerApi)
  .addHttpApi(PtyConnectApi)
  .annotate(HttpApi.AdditionalSchemas, [
    EventSchema,
    Question.Replied,
    Question.Rejected,
    Credential.Value,
    Integration.Inputs,
    Integration.Method,
    Integration.Ref,
    SkillV2.Source,
  ])

export type RootHttpApiType = typeof RootHttpApi
export type InstanceHttpApiType = typeof InstanceHttpApi
