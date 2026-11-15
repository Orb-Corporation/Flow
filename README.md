# Flow

**Flow** is a visual workflow builder by Orb Technologies.

## Product direction

- Visual, drag-and-drop workflow editing.
- A self-contained workflow format that can be saved, imported and exported.
- A local preview engine for testing block order, text values and conditional branches.
- Shared application code across Windows, macOS, Linux and Android.
- Future integrations, including an optional Orb! runtime adapter, can extend the preview engine without making the language a prerequisite.

## Current preview

- Add trigger, text, variable, condition, HTTP request and output blocks.
- Connect blocks to define execution order and YES/NO condition paths.
- Configure block names, text content, variables, request methods, URLs, headers and bodies.
- Use {{input}} and {{variableName}} placeholders in text, URL, header and body fields.
- Run a local preview; HTTP requests are sent from the device only after an explicit confirmation.
- Inspect node status, HTTP status codes and execution logs.
- Automatic local save, JSON import and export.
- A touch-friendly mobile layout and a first-run product tour.

**Execution boundary:** the preview engine runs the built-in trigger, text, variable, condition and output blocks locally. The HTTP Request block can send HTTP(S) requests from the device. Browser/webview CORS rules still apply. Credential-bearing headers (Authorization, cookies, API keys, tokens and similar values) are disabled until secure credential storage exists. Flow does not execute Orb! code, access local files or send email yet.

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