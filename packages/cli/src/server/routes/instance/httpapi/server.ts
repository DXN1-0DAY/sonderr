import { Config as EffectConfig, Context, Effect, Layer } from "effect"
import { HttpApiBuilder, OpenApi } from "effect/unstable/httpapi"
import { HttpClient, HttpMiddleware, HttpRouter, HttpServer, HttpServerResponse } from "effect/unstable/http"
import * as Socket from "effect/unstable/socket/Socket"
import { FSUtil } from "@sonderr/core/fs-util"
import path from "path"
import { EffectFlock } from "@sonderr/core/util/effect-flock" // sonderr_change
import * as Observability from "@sonderr/core/observability"
import { Account } from "@/account/account"
import { Agent } from "@/agent/agent"
import { Auth } from "@/auth"
import { BackgroundJob } from "@/background/job"
import { Command } from "@/command"
import { Config } from "@/config/config"
import { Workspace } from "@/control-plane/workspace"
import { Env } from "@/env"
import { EventV2Bridge } from "@/event-v2-bridge"
import { Format } from "@/format"
import { Git } from "@/git"
import { Installation } from "@/installation"
import { LSP } from "@/lsp/lsp"
import { MCP } from "@/mcp"
import { McpAuth } from "@/mcp/auth"
import { Permission } from "@/permission"
import { Plugin } from "@/plugin"
import { PluginPtyEnvironment } from "@/plugin/pty-environment"
import { InstanceStore } from "@/project/instance-store"
import { Project } from "@/project/project"
import { Vcs } from "@/project/vcs"
import { ProviderAuth } from "@/provider/auth"
import { ModelCache } from "@/provider/model-cache" // sonderr_change
import { Provider } from "@/provider/provider"
import { Question } from "@/question"
// sonderr_change start
import { Notebook } from "@/sonderr/notebook/service"
import { AgentManager } from "@/sonderr/agent-manager/service"
import { SonderrViewers } from "@/sonderr/presence/service"
// sonderr_change end
import { SessionCompaction } from "@/session/compaction"
import { Instruction } from "@/session/instruction"
import { LLM } from "@/session/llm"
import { SessionProcessor } from "@/session/processor"
import { SessionPrompt } from "@/session/prompt"
import { SessionRevert } from "@/session/revert"
import { SessionRunState } from "@/session/run-state"
import { Session } from "@/session/session"
import { SessionStatus } from "@/session/status"
import { SessionSummary } from "@/session/summary"
import { Todo } from "@/session/todo"
import { SessionShare } from "@/share/session"
import { ShareNext } from "@/share/share-next"
import { Credential } from "@sonderr/core/credential" // sonderr_change
import { Skill } from "@/skill"
import { Discovery } from "@/skill/discovery"
import { Snapshot } from "@/snapshot"
import { Storage } from "@/storage/storage"
import { SyncEvent } from "@/sync" // sonderr_change
import { ToolRegistry } from "@/tool/registry"
import { Truncate } from "@/tool/truncate"
import { Worktree } from "@/worktree"
import { MemoryService } from "@sonderr/sonderr-memory/effect/service" // sonderr_change
import { RuntimeFlags } from "@/effect/runtime-flags"
import { MoveSession } from "@sonderr/core/control-plane/move-session"
import { Database } from "@sonderr/core/database/database"
import { AppNodeBuilderV1 } from "@/effect/app-node-builder-v1"
import { LayerNode } from "@sonderr/core/effect/layer-node"
import { httpClient } from "@sonderr/core/effect/app-node-platform"
import { EventV2 } from "@sonderr/core/event"
import { ModelsDev } from "@sonderr/core/models-dev"
import { Npm } from "@sonderr/core/npm"
import { PermissionSaved } from "@sonderr/core/permission/saved"
import { ProjectV2 } from "@sonderr/core/project"
import { ProjectCopy } from "@sonderr/core/project/copy"
import { PtyTicket } from "@sonderr/core/pty/ticket"
import { Pty } from "@sonderr/core/pty" // sonderr_change
import { Ripgrep } from "@sonderr/core/ripgrep"
import { SessionProjector } from "@sonderr/core/session/projector"
import { SessionV2 } from "@sonderr/core/session"
import { SessionExecution } from "@sonderr/core/session/execution"
import * as SessionExecutionLocal from "@sonderr/core/session/execution/local"
import { lazy } from "@/util/lazy"
import { CorsConfig, isAllowedCorsOrigin, type CorsOptions } from "@sonderr/server/cors"
import { serveUIEffect } from "@/server/shared/ui"
import { ServerAuth } from "@/server/auth"
import { InstanceHttpApi, RootHttpApi, ServerApi } from "./api"
import { PublicApi } from "./public"
import {
  authorizationLayer,
  authorizationRouterMiddleware,
  ptyConnectAuthorizationLayer,
  serverAuthorizationLayer,
} from "./middleware/authorization"
import { EventApi } from "./groups/event"
import { PtyConnectApi } from "./groups/pty"
import { eventHandlers } from "./handlers/event"
import { configHandlers } from "./handlers/config"
import { controlHandlers } from "./handlers/control"
import { controlPlaneHandlers } from "./handlers/control-plane"
import { experimentalHandlers } from "./handlers/experimental"
import { fileHandlers } from "./handlers/file"
import { globalHandlers } from "./handlers/global"
import { instanceHandlers } from "./handlers/instance"
import { mcpHandlers } from "./handlers/mcp"
import { permissionHandlers } from "./handlers/permission"
import { projectHandlers } from "./handlers/project"
import { projectCopyHandlers } from "./handlers/project-copy"
import { providerHandlers } from "./handlers/provider"
import { ptyConnectHandlers, ptyHandlers } from "./handlers/pty"
import { questionHandlers } from "./handlers/question"
import { sessionHandlers } from "./handlers/session"
import { syncHandlers } from "./handlers/sync"
import { tuiHandlers } from "./handlers/tui"
import { handlers } from "@sonderr/server/handlers"
import {
  layer as referenceReconcilerLayer,
  locations as locationServiceMapLayer,
} from "@/sonderr/server/reference-reconciler" // sonderr_change
import { buildLocationServiceMap, LocationServiceMap } from "@sonderr/core/location-services"
import { layer as locationLayer } from "@sonderr/server/location"
import { sessionLocationLayer } from "@sonderr/server/middleware/session-location"
import { PtyEnvironment } from "@sonderr/server/pty-environment"
import { schemaErrorLayer as v2SchemaErrorLayer } from "@sonderr/server/middleware/schema-error"
import { workspaceHandlers } from "./handlers/workspace"
// sonderr_change start
import {
  provide as provideSonderrHttpApiHandlers,
  provideListener as provideSonderrListenerRoutes,
} from "@/sonderr/server/httpapi/server"
// sonderr_change end
import { instanceContextLayer } from "./middleware/instance-context"
import { workspaceRoutingLayer } from "./middleware/workspace-routing"
import { disposeMiddleware } from "./lifecycle"
import { memoMap } from "@sonderr/core/effect/memo-map"
import { compressionLayer } from "./middleware/compression"
import { corsVaryFix } from "./middleware/cors-vary"
import { errorLayer } from "./middleware/error"
import { fenceLayer } from "./middleware/fence"
import { schemaErrorLayer } from "./middleware/schema-error"

export const context = Context.makeUnsafe<unknown>(new Map())

const cors = (corsOptions?: CorsOptions) =>
  HttpRouter.middleware(
    HttpMiddleware.cors({
      allowedOrigins: (origin) => isAllowedCorsOrigin(origin, corsOptions),
      maxAge: 86_400,
    }),
    { global: true },
  )

// Route tree:
// - rootApiRoutes: typed /global/* and control routes; auth is declared by RootHttpApi.
// - eventApiRoutes: typed SSE route with instance routing context and its existing API contract.
// - ptyConnectApiRoutes: typed WebSocket upgrade route with ticket-aware auth.
// - instanceApiRoutes: remaining typed instance routes.
// - uiRoute: raw catch-all fallback; auth is router middleware so public static assets can bypass it.
const authOnlyRouterLayer = authorizationRouterMiddleware.layer.pipe(Layer.provide(ServerAuth.Config.layer))
const httpApiAuthLayer = authorizationLayer.pipe(Layer.provide(ServerAuth.Config.layer))
const ptyConnectHttpApiAuthLayer = ptyConnectAuthorizationLayer.pipe(Layer.provide(ServerAuth.Config.layer))
const serverHttpApiAuthLayer = serverAuthorizationLayer.pipe(Layer.provide(ServerAuth.Config.layer))
const workspaceRoutingLive = workspaceRoutingLayer.pipe(Layer.provide(Socket.layerWebSocketConstructorGlobal))
const rootApiRoutes = HttpApiBuilder.layer(RootHttpApi).pipe(
  Layer.provide([controlHandlers, controlPlaneHandlers, globalHandlers]),
  Layer.provide(schemaErrorLayer),
  Layer.provide(httpApiAuthLayer),
)
const eventApiRoutes = HttpApiBuilder.layer(EventApi).pipe(
  Layer.provide(eventHandlers),
  Layer.provide([httpApiAuthLayer, workspaceRoutingLive, instanceContextLayer]),
)
const ptyConnectApiRoutes = HttpApiBuilder.layer(PtyConnectApi).pipe(
  Layer.provide(ptyConnectHandlers),
  Layer.provide([ptyConnectHttpApiAuthLayer, workspaceRoutingLive, instanceContextLayer]),
)
const instanceApiRoutes = HttpApiBuilder.layer(InstanceHttpApi).pipe(
  Layer.provide([
    configHandlers,
    experimentalHandlers,
    fileHandlers,
    instanceHandlers,
    mcpHandlers,
    projectHandlers,
    projectCopyHandlers,
    ptyHandlers,
    questionHandlers,
    permissionHandlers,
    providerHandlers,
    sessionHandlers,
    syncHandlers,
    tuiHandlers,
    workspaceHandlers,
  ]),
  provideSonderrHttpApiHandlers, // sonderr_change
)

const instanceRoutes = instanceApiRoutes.pipe(
  Layer.provide([httpApiAuthLayer, workspaceRoutingLive, instanceContextLayer, schemaErrorLayer]),
)
const serverRoutes = HttpApiBuilder.layer(ServerApi).pipe(
  // sonderr_change start - effective references must be ready before any V2 location consumer runs
  Layer.provide(handlers.pipe(Layer.provide(locationServiceMapLayer), Layer.provide(referenceReconcilerLayer))),
  // sonderr_change end
  Layer.provide(PluginPtyEnvironment.layer),
  Layer.provide([serverHttpApiAuthLayer, v2SchemaErrorLayer]),
)

// `OpenApi.fromApi` is non-trivial; defer until /doc is actually hit so
// processes that never serve it (CLI, scripts) don't pay at module load.
// `HttpServerResponse.jsonUnsafe` runs JSON.stringify eagerly, so caching
// the response also caches the serialized body — every /doc request reuses
// the same Uint8Array instead of re-stringifying the spec.
const docResponse = lazy(() => HttpServerResponse.jsonUnsafe(OpenApi.fromApi(PublicApi)))

const docRoute = HttpRouter.use((router) => router.add("GET", "/doc", () => Effect.succeed(docResponse()))).pipe(
  Layer.provide(authOnlyRouterLayer),
)

// sonderr_change start - serve hive GUI setup UI
const hiveGuiSetupRoute = HttpRouter.use((router) =>
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const file = path.join(import.meta.dirname, "../../../sonderr/hive/gui-setup-ui/index.html")
    yield* router.add("GET", "/hive-gui-setup", () =>
      fs.readFile(file).pipe(
        Effect.map((body) => HttpServerResponse.raw(body, { headers: new Headers({ "content-type": "text/html" }) })),
        Effect.catchReason("PlatformError", "NotFound", () => Effect.succeed(notFound())),
      ),
    )
  }),
).pipe(Layer.provide(authOnlyRouterLayer))
// sonderr_change end

const uiRoute = HttpRouter.use((router) =>
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const client = yield* HttpClient.HttpClient
    const flags = yield* RuntimeFlags.Service
    yield* router.add("*", "/*", (request) =>
      serveUIEffect(request, { fs, client, disableEmbeddedWebUi: flags.disableEmbeddedWebUi }),
    )
  }),
).pipe(Layer.provide(authOnlyRouterLayer))

type RouteRequirements =
  | HttpRouter.HttpRouter
  | HttpRouter.Request<"Error", unknown>
  | HttpRouter.Request<"GlobalError", unknown>
  | HttpRouter.Request<"Requires", unknown>
  | HttpRouter.Request<"GlobalRequires", never>

const app = LayerNode.group([
  Npm.node,
  FSUtil.node,
  Database.node,
  Credential.node, // sonderr_change
  Auth.node,
  Account.node,
  Config.node,
  Env.node,
  Git.node,
  Ripgrep.node,
  Storage.node,
  Snapshot.node,
  Plugin.node,
  ModelsDev.node,
  ModelCache.node, // sonderr_change - export the shared Sonderr model cache to route handlers
  Provider.node,
  ProviderAuth.node,
  Agent.node,
  Skill.node,
  Discovery.node,
  Question.node,
  Permission.node,
  PermissionSaved.node,
  Todo.node,
  Session.node,
  SessionProjector.node,
  SessionStatus.node,
  BackgroundJob.node,
  RuntimeFlags.node,
  EventV2Bridge.node,
  SessionRunState.node,
  SessionProcessor.node,
  SessionCompaction.node,
  SessionRevert.node,
  SessionSummary.node,
  SessionPrompt.node,
  Instruction.node,
  LLM.node,
  LSP.node,
  MCP.node,
  McpAuth.node,
  Command.node,
  Truncate.node,
  ToolRegistry.node,
  Format.node,
  Project.node,
  Vcs.node,
  Workspace.node,
  Worktree.node,
  Installation.node,
  ShareNext.node,
  SessionShare.node,
  InstanceStore.node,
  httpClient,
  EventV2.node,
  ProjectV2.node,
  ProjectCopy.node,
  PtyTicket.node,
  Pty.shutdownNode, // sonderr_change
])

export function createRoutes(
  corsOptions?: CorsOptions,
): Layer.Layer<never, EffectConfig.ConfigError, RouteRequirements> {
  const locationServiceMapV2 = buildLocationServiceMap()

  return Layer.mergeAll(
    rootApiRoutes,
    eventApiRoutes,
    ptyConnectApiRoutes,
    instanceRoutes,
    serverRoutes,
    docRoute,
    hiveGuiSetupRoute,
    uiRoute,
  ).pipe(
    Layer.provide([
      errorLayer,
      compressionLayer,
      corsVaryFix,
      fenceLayer,
      cors(corsOptions),
      MemoryService.layer, // sonderr_change
      // sonderr_change start
      AgentManager.defaultLayer,
      Notebook.defaultLayer,
      SonderrViewers.defaultLayer,
      SyncEvent.defaultLayer,
      // sonderr_change end
      AppNodeBuilderV1.build(MoveSession.node, [[LocationServiceMap.node, locationServiceMapV2]]),
      AppNodeBuilderV1.build(EffectFlock.node), // sonderr_change
      HttpServer.layerServices,
    ]),
    Layer.provide(Layer.succeed(CorsConfig)(corsOptions)),
    Layer.provide(sessionLocationLayer),
    Layer.provide(locationLayer),
    Layer.provide(PtyEnvironment.layer),
    Layer.provide(
      AppNodeBuilderV1.build(SessionV2.node, [
        [LocationServiceMap.node, locationServiceMapV2],
        [SessionExecution.node, SessionExecutionLocal.node],
      ]),
    ),
    Layer.provide(locationServiceMapV2),

    Layer.provide(AppNodeBuilderV1.build(app)),
    // Must stay last: layers provided later in this pipe build beneath earlier ones,
    // so Observability must come after every service graph. Otherwise eagerly forked
    // fibers (e.g. the ModelsDev background refresh) capture Effect's default stdout
    // logger and corrupt the TUI (#34730).
    Layer.provideMerge(Observability.layer),
  )
}

// sonderr_change start - keep listener routes local while application services come from AppRuntime
export function createListenerRoutes(corsOptions?: CorsOptions) {
  const locationServiceMapV2 = buildLocationServiceMap()

  return Layer.mergeAll(
    rootApiRoutes,
    eventApiRoutes,
    ptyConnectApiRoutes,
    instanceRoutes,
    serverRoutes,
    docRoute,
    uiRoute,
  ).pipe(
    provideSonderrListenerRoutes(corsOptions),
    // Upstream's v2 ServerApi groups declare location/session middleware and services that must be
    // satisfied when the layer is built, not at request time, so the listener needs the same chain
    // createRoutes uses.
    //
    // These builds sit inside SonderrListener's Layer.fresh boundary, so each one self-provides its own
    // dependency subtree rather than resolving AppRuntime's. That is deliberate: SessionV2 is bound
    // to this listener's LocationServiceMap and to SessionExecutionLocal, so it cannot be the
    // process-wide instance. Everything the graph does not rebind (the nodes listed in AppLayer)
    // still comes from AppRuntime, and the scope teardown releases the rest.
    Layer.provide(sessionLocationLayer),
    Layer.provide(locationLayer),
    Layer.provide(PtyEnvironment.layer),
    Layer.provide(
      AppNodeBuilderV1.build(SessionV2.node, [
        [LocationServiceMap.node, locationServiceMapV2],
        [SessionExecution.node, SessionExecutionLocal.node],
      ]),
    ),
    Layer.provide(AppNodeBuilderV1.build(MoveSession.node, [[LocationServiceMap.node, locationServiceMapV2]])),
    Layer.provide(locationServiceMapV2),
  )
}
// sonderr_change end

export const routes = createRoutes()

export const webHandler = lazy(() =>
  HttpRouter.toWebHandler(routes, {
    disableLogger: true,
    memoMap,
    middleware: disposeMiddleware,
  }),
)

export * as HttpApiApp from "./server"
