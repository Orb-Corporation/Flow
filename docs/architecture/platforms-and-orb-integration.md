# Flow platform and integration architecture

## Product contract

Flow is a standalone visual workflow builder. A user can create, save, import, export and locally preview a workflow without installing Orb! or any other language runtime.

External integrations are an extension point, not a requirement for using the editor. Orb! may become a first-party optional execution adapter in the future. Do not make the editor, workflow format or basic preview depend on that adapter, and never show an integration as connected before a real handshake succeeds.

## Workflow document and preview engine

Keep the visual editor and versioned workflow document independent from any external execution engine.

The current local preview engine supports:
- Manual trigger.
- Text value creation/replacement, including {{input}} and {{variableName}} interpolation.
- Named variables that remain available to later blocks in the run.
- Case-insensitive text-match conditions with YES/NO branches.
- HTTP(S) requests with configurable method, JSON headers, request body and timeout.
- Output logging.

HTTP requests are made from the local device after an explicit run confirmation. Browser/webview CORS restrictions remain in effect. Credential-bearing headers are disabled until platform secure-storage support is implemented. The preview engine must reject unsupported graph cycles rather than silently skipping nodes. It does not access local files or send email.

## Optional integration boundary

Future adapters should expose a small, versioned interface:
- `runtime.info`: runtime version, protocol version and supported capabilities.
- `workflow.validate`: validate a workflow without executing it.
- `workflow.compile`: compile the graph to an adapter-specific execution plan.
- `workflow.run`: start a run and return a run ID.
- `workflow.cancel`: cancel a run.
- `run.event`: stream node-started, node-finished, output and error events.

The editor must remain usable when no adapter is installed. Credentials must be stored in the platform's secure credential store, never in workflow JSON or localStorage. Optional adapters must be explicit about required runtimes and permissions. The current HTTP block intentionally rejects common credential headers until secure storage is available.

## Supported platforms

The target application shell is Tauri 2:
- Windows: NSIS setup executable and MSI.
- macOS: DMG and app bundle.
- Linux: AppImage and DEB initially; RPM can follow.
- Android: APK for direct testing/distribution, with Play Store packaging later.

The React workflow editor remains shared. Platform-specific file access, notifications, secure storage and background execution should go through narrow native adapters rather than browser-only APIs.

## Installation and first-run experience

Desktop installers should provide the normal OS-native install flow. The current first-run wizard is an in-app product tour, not a system setup wizard or runtime installer.

Android does not permit a desktop-style installer wizard. Deliver an APK/app-store install, then show the same first-run tour adapted to touch.

No terminal commands, Node.js, Rust, Python or manual dependency installation should be required for end users.

## Build and release

Build each desktop installer on its native GitHub Actions runner. Tauri does not promise reliable cross-compilation for every installer format. Android requires its own Android SDK/NDK/JDK build job and signing configuration.

Release gates:
- frontend typecheck and production build;
- desktop shell compilation on Windows, macOS and Linux;
- Android APK build;
- install smoke test on each platform;
- checksums and signed release artifacts when signing credentials are available.

## Current status

The repository contains a React editor, a local demonstration engine, first-run tour and Tauri 2 scaffolding. External integrations, a native setup wizard, install smoke tests, installer signing and release distribution are not complete. Do not advertise these as shipped capabilities until verified.