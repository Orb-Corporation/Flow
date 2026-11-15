# Flow platform and Orb! integration architecture

## Product contract

Flow is a first-party Orb Technologies product. Orb! is the preferred and native automation language/runtime. The visual editor should generate and execute workflows through the Orb! runtime rather than making users write code by hand.

Other-language steps may be supported through explicit adapters, but Orb! is the default path:
- Orb! workflows: built-in blocks, first-class debugging, native types and standard library access.
- External scripts: opt-in adapters with an explicit runtime/dependency check. They must not be required for ordinary workflows.

Do not fake an Orb! connection. The UI may only show Orb! as connected after the runtime handshake succeeds.

## Integration boundary

Keep the React editor and workflow document format independent from the execution engine.

1. The editor creates a versioned workflow graph.
2. A compiler adapter converts the graph into an Orb! workflow module.
3. The Orb! runtime executes the module and streams structured events back to Flow.
4. Flow renders logs, node states, errors and outputs.
5. The same adapter contract is used by desktop and Android builds.

The initial bridge contract should use versioned JSON messages. Required operations:
- `runtime.info`: runtime version, protocol version and supported capabilities.
- `workflow.validate`: validate a workflow without executing it.
- `workflow.compile`: compile the graph to an Orb! execution plan.
- `workflow.run`: start a run and return a run ID.
- `workflow.cancel`: cancel a run.
- `run.event`: stream node-started, node-finished, output and error events.

The protocol must be versioned and reject incompatible major versions. Credentials must be stored in the platform's secure credential store, never in workflow JSON or localStorage.

## Orb! distribution strategy

Preferred experience: the Flow installer includes the compatible Orb! runtime component, so users do not have to install a language toolchain separately. If the runtime cannot be bundled for a platform yet, the setup wizard must explain the missing component and offer a guided Orb! installation; it must never silently fall back to a fake runner.

Orb! runtime binaries and licenses must be supplied by the Orb! project and pinned to a tested version. Do not download arbitrary executables at first launch.

## Supported platforms

The target application shell is Tauri 2:
- Windows: NSIS setup executable and MSI.
- macOS: DMG and app bundle.
- Linux: AppImage and DEB initially; RPM can follow.
- Android: signed APK for direct testing/distribution, with Play Store packaging later.

The React workflow editor remains shared. Platform-specific file access, notifications, secure storage and background execution must go through a narrow native adapter rather than browser-only APIs.

## Installation and first-run experience

Desktop installers should provide a normal OS-native install flow. On first launch, Flow opens a short setup wizard:
1. Welcome and platform compatibility check.
2. Install/verify the bundled Orb! runtime.
3. Choose where workflow files are stored.
4. Optional startup and notification preferences.
5. Run a built-in sample workflow and confirm success.

Android does not permit a desktop-style installer wizard. Deliver an APK/app-store install, then show the same first-run setup as an in-app onboarding flow adapted to touch.

No terminal commands, Node.js, Rust, Python or manual dependency installation should be required for end users.

## Build and release

Build each desktop installer on its native GitHub Actions runner. Tauri does not promise reliable cross-compilation for every installer format. Android requires its own Android SDK/NDK/JDK build job and signing configuration.

Release gates:
- frontend typecheck and production build;
- desktop shell compilation on Windows, macOS and Linux;
- Android APK build;
- install smoke test on each platform;
- Orb! runtime handshake and sample workflow test;
- SHA-256 checksums and signed release artifacts when signing credentials are available.

## Current status

The repository currently has a React web editor and a local demonstration runner. Tauri 2 scaffolding is being introduced. The Orb! runtime bridge, bundled runtime, Android project initialization, installer signing and native install smoke tests are not complete yet. Do not advertise these as shipped capabilities until verified.
