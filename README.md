# Flow

**Flow** is a visual workflow builder by Orb Technologies. Its goal is to make automation understandable: add blocks, connect them, configure them, and run a workflow.

> Early preview: the current runner is a local demonstration engine. It does not connect to external services or run background automations yet.

## Current preview

- Drag blocks from the left panel onto the canvas, or click to add them.
- Connect blocks by dragging between their handles.
- Select a block to edit its settings.
- Run a small local workflow and inspect the execution log.
- Workflows are saved automatically in the current browser.
- Import and export workflows as JSON.

## Blocks

| Block | Purpose |
| --- | --- |
| Manual trigger | Starts a workflow when Run is pressed |
| Text | Creates a text value for the next block |
| Condition | Routes the workflow through YES or NO based on an incoming text value |
| Output | Writes the incoming value to the run console |

## Run locally

Requirements: Node.js 20.19+.

```bash
npm install
npm run dev
```

Create a production build:

```bash
npm run build
npm run preview
```

## Product direction

The first milestone is a reliable, approachable editor. Future milestones can add reusable templates, real triggers, integrations, credentials, execution history, and a secure automation runtime. Those capabilities are not part of this preview.

## License

The project is currently in active development. A license will be added before the first public stable release.
