import { Layer } from "effect"
import { FetchHttpClient, HttpMiddleware, HttpRouter, HttpServer } from "effect/unstable/http"
import { CorsConfig, isAllowedCorsOrigin, type CorsOptions } from "@sonderr/server/cors"
import { compressionLayer } from "@/server/routes/instance/httpapi/middleware/compression"
import { corsVaryFix } from "@/server/routes/instance/httpapi/middleware/cors-vary"
import { errorLayer } from "@/server/routes/instance/httpapi/middleware/error"
import { fenceLayer } from "@/server/routes/instance/httpapi/middleware/fence"
import * as AnacondaDesktop from "@/sonderr/anaconda-desktop/service"
import { EffectFlock } from "@sonderr/core/util/effect-flock"
import { AppNodeBuilderV1 } from "@/effect/app-node-builder-v1" // sonderr_change - defaultLayer aliases are gone

import { SonderrViewers } from "@/sonderr/presence/service" // sonderr_change
import { agentBuilderHandlers } from "./handlers/agent-builder"
import { anacondaDesktopHandlers } from "./handlers/anaconda-desktop"
import { backgroundProcessHandlers } from "./handlers/background-process"
import { branchNameHandlers } from "./handlers/branch-name"
import { commitMessageHandlers } from "./handlers/commit-message"
import { configConsoleHandlers } from "./handlers/config-console"
import { enhancePromptHandlers } from "./handlers/enhance-prompt"
import { HiveGuiSetup, node as HiveGuiSetupNode } from "@/sonderr/hive/gui-setup"
import { hiveGuiSetupHandlers } from "./handlers/hive-gui-setup"
import { LayerNode } from "@sonderr/core/effect/layer-node"
import { indexingHandlers } from "./handlers/indexing"
import { instanceReloadHandlers } from "./handlers/instance-reload"
import { interactiveTerminalHandlers } from "./handlers/interactive-terminal"
import { sonderrGatewayHandlers } from "./handlers/sonderr-gateway"
import { sonderrHandlers } from "./handlers/sonderr"
import { memoryHandlers } from "./handlers/memory"
import { networkHandlers } from "./handlers/network"
import { remoteHandlers } from "./handlers/remote"
import { sandboxHandlers } from "./handlers/sandbox"
import { sessionImportHandlers } from "./handlers/session-import"
import { suggestionHandlers } from "./handlers/suggestion"
import { telemetryHandlers } from "./handlers/telemetry"

export const provide = Layer.provide([
  agentBuilderHandlers,
  anacondaDesktopHandlers.pipe(Layer.provide(AnacondaDesktop.liveLayer)),
  backgroundProcessHandlers,
  branchNameHandlers,
  commitMessageHandlers,
  configConsoleHandlers,
  enhancePromptHandlers,
  hiveGuiSetupHandlers.pipe(Layer.provide(LayerNode.compile(HiveGuiSetupNode))),
  indexingHandlers,
  instanceReloadHandlers,
  interactiveTerminalHandlers,
  sonderrGatewayHandlers,
  sonderrHandlers,
  memoryHandlers,
  networkHandlers,
  remoteHandlers,
  sandboxHandlers,
  sessionImportHandlers,
  suggestionHandlers,
  telemetryHandlers,
])

export function provideListener(opts?: CorsOptions) {
  const cors = HttpRouter.middleware(
    HttpMiddleware.cors({
      allowedOrigins: (origin) => isAllowedCorsOrigin(origin, opts),
      maxAge: 86_400,
    }),
    { global: true },
  )
  return Layer.provide([
    errorLayer,
    compressionLayer,
    corsVaryFix,
    fenceLayer,
    cors,
    SonderrViewers.defaultLayer, // sonderr_change
    AppNodeBuilderV1.build(EffectFlock.node),
    FetchHttpClient.layer,
    HttpServer.layerServices,
    Layer.succeed(CorsConfig)(opts),
  ])
}
