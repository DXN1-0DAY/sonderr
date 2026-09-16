/** @jsxImportSource @opentui/solid */
/**
 * Sonderr Gateway Commands for TUI
 *
 * Provides /profile and /teams commands that are only visible when connected to Sonderr Gateway.
 */

import { createMemo } from "solid-js"
import open from "open"
import { useBindings } from "@tui/keymap"
import { useSync } from "@tui/context/sync"
import { useRoute } from "@tui/context/route"
import { useDialog } from "@tui/ui/dialog"
import { useToast } from "@tui/ui/toast"
import { DialogAlert } from "@tui/ui/dialog-alert"
import { DialogConfirm } from "@tui/ui/dialog-confirm"
import { reconcile } from "solid-js/store"
import type { Organization } from "@sonderr/sonderr-gateway"
import type { ClawStatus } from "./claw/types.js"
import { DialogSonderrTeamSelect } from "./components/dialog-sonderr-team-select.js"
import { DialogSonderrProfile } from "./components/dialog-sonderr-profile.js"
import { DialogClawSetup } from "./components/dialog-claw-setup.js"
import { DialogClawUpgrade } from "./components/dialog-claw-upgrade.js"
import { DialogIndexing } from "./components/dialog-indexing.js"
import { DialogProviderUsage } from "./components/dialog-provider-usage.js"
import { indexingEnabled } from "./indexing-feature"
import { refreshBalance } from "./balance-refresh"

// These types are Sonderr-internal and imported at runtime
type UseSDK = any
type SDK = any

/**
 * Register all Sonderr Gateway commands
 * Call this from a component inside the TUI app
 *
 * @param useSDK - Sonderr's useSDK hook (passed from TUI context)
 */
export function registerSonderrCommands(useSDK: () => UseSDK) {
  const sync = useSync()
  const route = useRoute()
  const dialog = useDialog()
  const sdk = useSDK()
  const toast = useToast()

  // Only show Sonderr commands when connected to Sonderr Gateway
  const isSonderrConnected = createMemo(() => {
    return sync.data.provider_next.connected.includes("sonderr")
  })
  const indexing = createMemo(() => indexingEnabled(sync.data.config))

  useBindings(() => ({
    commands: [
      // /sonderrclaw command
      {
        name: "sonderr.claw",
        title: "SonderrClaw",
        desc: "Open SonderrClaw chat & dashboard",
        category: "Sonderr",
        slashName: "sonderrclaw",
        slashAliases: ["claw"],
        enabled: isSonderrConnected(),
        hidden: !isSonderrConnected(),
        run: async () => {
          // Fetch profile (for org context) and instance status in parallel
          const [profileRes, res] = await Promise.all([
            sdk.client.sonderr.profile().catch(() => null),
            sdk.client.sonderr.claw.status().catch(() => null),
          ])
          const orgId = profileRes?.data?.currentOrgId ?? null
          const status = res?.data as ClawStatus | undefined

          // No instance provisioned
          if (!status || !status.userId || res.error) {
            dialog.replace(() => <DialogClawSetup orgId={orgId} />)
            return
          }

          // Instance exists — check for chat credentials
          const creds = await sdk.client.sonderr.claw.chatCredentials().catch(() => null)

          if (!creds?.data || creds.error) {
            // Instance exists but no chat credentials — needs upgrade
            dialog.replace(() => <DialogClawUpgrade orgId={orgId} />)
            return
          }

          // Everything ready — navigate to full-screen chat view
          route.navigate({ type: "sonderrclaw" })
          dialog.clear()
        },
      },

      // /hive-gui-setup command
      {
        name: "sonderr.hive-gui-setup",
        title: "Hive GUI Setup",
        desc: "Open the hive GUI setup in a browser",
        category: "Hive",
        slashName: "hive-gui-setup",
        run: async () => {
          try {
            const url = "http://localhost:4096/hive-gui-setup"
            await open(url).catch(() => undefined)
            toast.show({ message: `Opening hive GUI setup at ${url}`, variant: "success" })
          } catch (error) {
            dialog.replace(() => <DialogAlert title="Error" message={`Failed to open hive GUI setup: ${error}`} />)
          }
        },
      },

      // /remote command
      {
        name: "remote.toggle",
        title: "Toggle remote",
        desc: "Enable or disable remote session relay",
        category: "Sonderr",
        slashName: "remote",
        enabled: isSonderrConnected(),
        hidden: !isSonderrConnected(),
        run: async () => {
          try {
            const current = await sdk.client.remote.status()

            if (current.error || !current.data) {
              dialog.replace(() => <DialogAlert title="Error" message="Failed to fetch remote status." />)
              return
            }

            if (current.data.enabled) {
              await sdk.client.remote.disable()
              toast.show({ message: "Remote disabled", variant: "success" })
            } else {
              const result = await sdk.client.remote.enable()
              if (result.error) {
                const err = result.error as { error?: string }
                const msg = err?.error ?? "Failed to enable remote."
                dialog.replace(() => <DialogAlert title="Error" message={msg} />)
                return
              }
              toast.show({ message: "Remote enabled", variant: "success" })
            }

            dialog.clear()
          } catch (error) {
            dialog.replace(() => <DialogAlert title="Error" message={`Failed to toggle remote: ${error}`} />)
          }
        },
      },

      {
        name: "sonderr.usage",
        title: "Plans & usage",
        desc: "View provider plans and quota",
        category: "Sonderr",
        slashName: "usage",
        slashAliases: ["plans", "quota"],
        run: () => {
          dialog.replace(() => <DialogProviderUsage />)
        },
      },

      // /profile command
      {
        name: "sonderr.profile",
        title: "Profile",
        desc: "View your Sonderr Gateway profile",
        category: "Sonderr",
        slashName: "profile",
        slashAliases: ["me", "whoami"],
        enabled: isSonderrConnected(),
        hidden: !isSonderrConnected(),
        run: async () => {
          try {
            if (sync.data.config.privacy_mode === true || sync.data.globalConfig.privacy_mode === true) {
              const confirmed = await DialogConfirm.show(
                dialog,
                "Privacy Mode Enabled",
                "Privacy mode is on. Revealing your profile will display your email, name, balance, and team on screen.",
              )
              if (confirmed !== true) return
            }

            // Fetch profile and balance using server endpoint
            const response = await sdk.client.sonderr.profile()

            if (response.error || !response.data) {
              dialog.replace(() => (
                <DialogAlert
                  title="Error"
                  message="Failed to fetch profile. Please ensure you're authenticated with Sonderr Gateway."
                />
              ))
              return
            }

            const { profile, balance, currentOrgId } = response.data

            // Show profile dialog with clickable usage link
            dialog.replace(() => <DialogSonderrProfile profile={profile} balance={balance} currentOrgId={currentOrgId} />)
          } catch (error) {
            dialog.replace(() => <DialogAlert title="Error" message={`Failed to fetch profile: ${error}`} />)
          }
        },
      },

      ...(indexing()
        ? [
            {
              name: "sonderr.indexing",
              title: "Indexing",
              desc: "Configure codebase indexing",
              category: "Sonderr",
              slashName: "indexing",
              slashAliases: ["index", "embedding"],
              run: () => {
                dialog.replace(() => <DialogIndexing useSDK={useSDK} />)
              },
            },
          ]
        : []),

      // /privacy command
      {
        name: "sonderr.privacy",
        get title() {
          const active = sync.data.config.privacy_mode === true || sync.data.globalConfig.privacy_mode === true
          return active ? "Disable privacy mode" : "Enable privacy mode"
        },
        desc: "Blur PII (balance, email, etc.) and confirm before showing profile",
        category: "Sonderr",
        slashName: "privacy",
        run: async () => {
          const active = sync.data.config.privacy_mode === true || sync.data.globalConfig.privacy_mode === true
          const next = !active
          const updates = [
            sdk.client.config.overlayUpdate({
              scope: "global",
              set: { privacy_mode: next },
            }),
          ]
          if (!next && sync.data.config.privacy_mode === true) {
            updates.push(
              sdk.client.config.overlayUpdate({
                scope: "project",
                unset: [["privacy_mode"]],
              }),
            )
          }
          const responses = await Promise.all(updates)
          const failed = responses.find((r) => r.error)
          if (failed) {
            const status = failed.response?.status ?? "?"
            toast.show({ message: `Failed to update privacy mode (${status})`, variant: "error" })
            return
          }
          const [cfg, global] = await Promise.all([
            sdk.client.config.get({}),
            sdk.client.global.config.get({}),
          ])
          if (cfg.data) sync.set("config", reconcile(cfg.data))
          if (global.data) sync.set("globalConfig", reconcile(global.data))
          toast.show({
            message: next ? "Privacy mode enabled" : "Privacy mode disabled",
            variant: "success",
          })
        },
      },

      // /teams command
      {
        name: "sonderr.teams",
        title: "Teams",
        desc: "Switch between Sonderr Gateway teams",
        category: "Sonderr",
        slashName: "teams",
        slashAliases: ["team", "org", "orgs"],
        enabled: isSonderrConnected(),
        hidden: !isSonderrConnected(),
        run: async () => {
          try {
            // Fetch profile to get organizations
            const response = await sdk.client.sonderr.profile()

            if (response.error || !response.data) {
              dialog.replace(() => (
                <DialogAlert
                  title="Error"
                  message="Failed to fetch teams. Please ensure you're authenticated with Sonderr Gateway."
                />
              ))
              return
            }

            const { profile, currentOrgId } = response.data

            if (!profile.organizations || profile.organizations.length === 0) {
              dialog.replace(() => (
                <DialogAlert
                  title="No Teams Available"
                  message="You're not a member of any teams.\nVisit https://app.kilo.ai to create or join a team."
                />
              ))
              return
            }

            // Show team selection dialog
            dialog.replace(() => (
              <DialogSonderrTeamSelect
                organizations={profile.organizations!}
                currentOrgId={currentOrgId}
                hasPersonalAccount={profile.hasPersonalAccount !== false}
                onSelect={async (orgId) => {
                  try {
                    // Switch to team immediately using server endpoint
                    const result = await sdk.client.sonderr.organization.set({
                      organizationId: orgId,
                    })
                    if (result.error) {
                      toast.show({
                        message: "Failed to switch team",
                        variant: "error",
                      })
                      dialog.clear()
                      return
                    }

                    // Refresh provider state to reload models with new organization context
                    await sdk.client.instance.dispose()
                    await sync.bootstrap()

                    // Update the sidebar balance immediately for the newly selected account
                    refreshBalance()

                    // Show success toast
                    const teamName = orgId
                      ? profile.organizations!.find((o: Organization) => o.id === orgId)?.name
                      : "Personal"

                    toast.show({
                      message: `Switched to: ${teamName}`,
                      variant: "success",
                    })

                    // Close dialog
                    dialog.clear()
                  } catch (error) {
                    if (error instanceof DOMException && error.name === "AbortError") return
                    toast.show({
                      message: "Failed to switch team",
                      variant: "error",
                    })
                    dialog.clear()
                  }
                }}
              />
            ))
          } catch (error) {
            dialog.replace(() => <DialogAlert title="Error" message={`Failed to fetch teams: ${error}`} />)
          }
        },
      },
    ].map((command) => ({
      namespace: "palette",
      ...command,
    })),
  }))
}
