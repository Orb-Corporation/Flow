# Flow

**Flow** is a visual workflow automation application by Orb Technologies, designed around the Orb! language and runtime.

## Product direction

- Visual, drag-and-drop workflow editing.
- Orb! as the native workflow language and execution runtime.
- Shared application code across Windows, macOS, Linux and Android.
- Native installers and a guided first-run setup; end users should not need to install developer toolchains.
- Optional external-language adapters, without making them the default path.

## Current preview

- Drag blocks onto a canvas and connect them.
- Configure text and condition blocks.
- Run the local demonstration engine and inspect logs.
- Automatic browser save, JSON import and export.

**Important:** the current runner is a local demonstration only. It does not execute Orb! code or connect to external services yet. The Tauri application shell and platform installers are being introduced; platform builds are not yet release-ready.

## Development

Requirements for contributors: Node.js 20.19+ and Rust stable. Platform-specific Tauri prerequisites are required to build native packages.

```bash
npm install
npm run dev
```

Desktop shell:

```bash
npm run tauri:dev
npm run tauri:build
```

Android development additionally requires Android Studio, Android SDK/NDK and a JDK. See the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

## Platform and Orb! architecture

See [the platform and Orb! integration plan](docs/architecture/platforms-and-orb-integration.md).

## License

A project license will be added before the first public stable release.
