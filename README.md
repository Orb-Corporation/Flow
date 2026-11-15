# Flow

**Flow** is a visual workflow builder by Orb Technologies.

## Product direction

- Visual, drag-and-drop workflow editing.
- A self-contained workflow format that can be saved, imported and exported.
- A local preview engine for testing block order, text values and conditional branches.
- Shared application code across Windows, macOS, Linux and Android.
- Future integrations, including an optional Orb! runtime adapter, can extend the preview engine without making the language a prerequisite.

## Current preview

- Add trigger, text, condition and output blocks.
- Connect blocks to define execution order and YES/NO condition paths.
- Configure block names, text content and match conditions.
- Run a local preview and watch node status and execution logs update.
- Automatic local save, JSON import and export.
- A touch-friendly mobile layout and a first-run product tour.

**Execution boundary:** the current preview engine only processes the four built-in block types locally. It does not execute Orb! code, call external APIs, send messages, or access local files. Integrations are not shipped yet.

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

## Architecture

See [the platform and integration plan](docs/architecture/platforms-and-orb-integration.md).

## License

A project license will be added before the first public stable release.