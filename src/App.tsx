import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import type { Connection, Edge, Node, NodeProps, NodeTypes } from '@xyflow/react'
import OnboardingWizard from './OnboardingWizard'
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Code2,
  FileJson,
  GitBranch,
  Grip,
  Keyboard,
  MousePointer2,
  Play,
  Plus,
  Save,
  Search,
  Sparkles,
  Terminal,
  Trash2,
  Type,
  Workflow,
  X,
  Zap,
} from 'lucide-react'

type NodeKind = 'trigger' | 'text' | 'condition' | 'log'
type RunStatus = 'idle' | 'running' | 'success' | 'error'
type MobilePanel = 'blocks' | 'settings' | null

type FlowNodeData = {
  kind: NodeKind
  title: string
  description: string
  text: string
  match: string
  status: RunStatus
}

type FlowNode = Node<FlowNodeData>

type SavedWorkspace = {
  version: 1
  name: string
  nodes: FlowNode[]
  edges: Edge[]
}

const STORAGE_KEY = 'flow-workspace-v1'
const ONBOARDING_KEY = 'flow-onboarding-complete-v1'

const NODE_INFO: Record<NodeKind, { title: string; description: string; category: string }> = {
  trigger: {
    title: 'Manual trigger',
    description: 'Start this workflow when you press Run.',
    category: 'Triggers',
  },
  text: {
    title: 'Text',
    description: 'Create or replace a piece of text.',
    category: 'Actions',
  },
  condition: {
    title: 'Condition',
    description: 'Choose a path based on the incoming text.',
    category: 'Logic',
  },
  log: {
    title: 'Output',
    description: 'Add the incoming value to the run log.',
    category: 'Actions',
  },
}

const NODE_ICONS = {
  trigger: Zap,
  text: Type,
  condition: GitBranch,
  log: Terminal,
}

function makeNode(kind: NodeKind, id: string, position: { x: number; y: number }): FlowNode {
  const info = NODE_INFO[kind]
  return {
    id,
    type: 'flowNode',
    position,
    data: {
      kind,
      title: info.title,
      description: info.description,
      text: kind === 'text' ? 'Hello from Flow. Your first workflow is ready.' : '',
      match: kind === 'condition' ? 'Flow' : '',
      status: 'idle',
    },
  }
}

const starterNodes: FlowNode[] = [
  makeNode('trigger', 'trigger-start', { x: 80, y: 180 }),
  makeNode('text', 'text-message', { x: 370, y: 180 }),
  makeNode('log', 'output-result', { x: 660, y: 180 }),
]

const starterEdges: Edge[] = [
  { id: 'edge-start-text', source: 'trigger-start', target: 'text-message', type: 'smoothstep' },
  { id: 'edge-text-output', source: 'text-message', target: 'output-result', type: 'smoothstep' },
]

function loadWorkspace(): SavedWorkspace {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as SavedWorkspace
      if (
        parsed.version === 1 &&
        Array.isArray(parsed.nodes) &&
        Array.isArray(parsed.edges) &&
        typeof parsed.name === 'string'
      ) {
        return parsed
      }
    }
  } catch {
    // A damaged or unavailable local save should never prevent the editor from opening.
  }

  return {
    version: 1,
    name: 'My first workflow',
    nodes: starterNodes,
    edges: starterEdges,
  }
}

function WorkflowNode({ data, selected }: NodeProps<FlowNode>) {
  const Icon = NODE_ICONS[data.kind]
  const isCondition = data.kind === 'condition'

  return (
    <>
      <Handle type="target" position={Position.Left} className="flow-handle" />
      <div className={`workflow-node ${selected ? 'is-selected' : ''} status-${data.status}`}>
        <div className="workflow-node-top">
          <span className={`node-icon node-icon-${data.kind}`}>
            <Icon size={16} strokeWidth={2.1} />
          </span>
          <span className="node-category">{NODE_INFO[data.kind].category}</span>
          <span className="node-state">
            {data.status === 'running' && <span className="status-dot is-running" />}
            {data.status === 'success' && <Check size={13} />}
            {data.status === 'error' && <X size={13} />}
          </span>
        </div>
        <div className="workflow-node-title">{data.title}</div>
        <div className="workflow-node-description">{data.description}</div>
        {data.kind === 'text' && (
          <div className="node-preview">{data.text || 'No text configured yet'}</div>
        )}
        {data.kind === 'condition' && (
          <div className="condition-preview">
            <span>YES</span>
            <span>NO</span>
          </div>
        )}
        {data.kind === 'log' && <div className="node-preview output-preview">Run output</div>}
      </div>
      {isCondition ? (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="yes"
            className="flow-handle condition-handle handle-yes"
          />
          <Handle
            type="source"
            position={Position.Right}
            id="no"
            className="flow-handle condition-handle handle-no"
          />
        </>
      ) : (
        <Handle type="source" position={Position.Right} className="flow-handle" />
      )}
    </>
  )
}

const nodeTypes: NodeTypes = { flowNode: WorkflowNode }

type PaletteItemProps = {
  kind: NodeKind
  onAdd: (kind: NodeKind) => void
}

function PaletteItem({ kind, onAdd }: PaletteItemProps) {
  const Icon = NODE_ICONS[kind]
  const info = NODE_INFO[kind]

  return (
    <button
      className="palette-item"
      draggable
      onClick={() => onAdd(kind)}
      onDragStart={(event) => {
        event.dataTransfer.setData('application/flow-node', kind)
        event.dataTransfer.effectAllowed = 'move'
      }}
      title={`Add ${info.title}`}
      type="button"
    >
      <span className={`palette-icon node-icon-${kind}`}>
        <Icon size={16} />
      </span>
      <span className="palette-copy">
        <strong>{info.title}</strong>
        <small>{info.description}</small>
      </span>
      <Plus className="palette-plus" size={15} />
    </button>
  )
}

function FlowEditor() {
  const saved = useMemo(() => loadWorkspace(), [])
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(saved.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(saved.edges)
  const [workflowName, setWorkflowName] = useState(saved.name)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [notice, setNotice] = useState('')
  const [runLogs, setRunLogs] = useState<string[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [savedLocally, setSavedLocally] = useState(true)
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null)
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return window.localStorage.getItem(ONBOARDING_KEY) !== 'done'
    } catch {
      return true
    }
  })
  const importInputRef = useRef<HTMLInputElement>(null)
  const { screenToFlowPosition, fitView } = useReactFlow()

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null

  const finishOnboarding = () => {
    try {
      window.localStorage.setItem(ONBOARDING_KEY, 'done')
    } catch {
      // The tour can still be dismissed when persistent storage is unavailable.
    }
    setShowOnboarding(false)
  }

  const openOnboarding = () => {
    setMobilePanel(null)
    setShowOnboarding(true)
  }

  useEffect(() => {
    try {
      const workspace: SavedWorkspace = {
        version: 1,
        name: workflowName,
        nodes,
        edges,
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace))
      setSavedLocally(true)
    } catch {
      setSavedLocally(false)
    }
  }, [edges, nodes, workflowName])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 3200)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const addNode = useCallback(
    (kind: NodeKind, position?: { x: number; y: number }) => {
      const id = `${kind}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
      const nextPosition = position ?? {
        x: 160 + (nodes.length % 4) * 48,
        y: 110 + (nodes.length % 5) * 34,
      }
      const nextNode = makeNode(kind, id, nextPosition)
      setNodes((current) => [...current, nextNode])
      setSelectedNodeId(id)
      if (window.matchMedia('(max-width: 640px)').matches) setMobilePanel('settings')
      setNotice(`${NODE_INFO[kind].title} added`)
    },
    [nodes.length, setNodes],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            type: 'smoothstep',
            animated: false,
          },
          current,
        ),
      )
    },
    [setEdges],
  )

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault()
      const kind = event.dataTransfer.getData('application/flow-node') as NodeKind
      if (!kind || !(kind in NODE_INFO)) return
      addNode(kind, screenToFlowPosition({ x: event.clientX, y: event.clientY }))
    },
    [addNode, screenToFlowPosition],
  )

  const updateSelectedNode = (patch: Partial<FlowNodeData>) => {
    if (!selectedNodeId) return
    setNodes((current) =>
      current.map((node) =>
        node.id === selectedNodeId ? { ...node, data: { ...node.data, ...patch } } : node,
      ),
    )
  }

  const deleteSelectedNode = () => {
    if (!selectedNodeId) return
    setNodes((current) => current.filter((node) => node.id !== selectedNodeId))
    setEdges((current) =>
      current.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId),
    )
    setSelectedNodeId(null)
    setNotice('Block removed')
  }

  const startNewWorkflow = () => {
    setNodes([])
    setEdges([])
    setWorkflowName('Untitled workflow')
    setSelectedNodeId(null)
    setMobilePanel(null)
    setRunLogs([])
    setNotice('New workflow created')
  }

  const exportWorkspace = () => {
    const workspace: SavedWorkspace = {
      version: 1,
      name: workflowName,
      nodes,
      edges,
    }
    const blob = new Blob([JSON.stringify(workspace, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${workflowName.trim().replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'flow-workflow'}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setNotice('Workflow exported')
  }

  const importWorkspace = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const parsed = JSON.parse(await file.text()) as SavedWorkspace
      if (
        parsed.version !== 1 ||
        !Array.isArray(parsed.nodes) ||
        !Array.isArray(parsed.edges) ||
        typeof parsed.name !== 'string'
      ) {
        throw new Error('This file is not a supported Flow workflow.')
      }

      setNodes(parsed.nodes)
      setEdges(parsed.edges)
      setWorkflowName(parsed.name)
      setSelectedNodeId(null)
      setRunLogs([])
      setNotice('Workflow imported')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not import this file')
    } finally {
      event.target.value = ''
    }
  }

  const runWorkflow = async () => {
    if (isRunning) return
    const triggers = nodes.filter((node) => node.data.kind === 'trigger')
    if (triggers.length === 0) {
      setNotice('Add a Manual trigger before running this workflow')
      return
    }

    setIsRunning(true)
    setRunLogs([])
    setNodes((current) =>
      current.map((node) => ({ ...node, data: { ...node.data, status: 'idle' } })),
    )

    const queue: Array<{ id: string; value: string }> = triggers.map((node) => ({
      id: node.id,
      value: '',
    }))
    const visited = new Set<string>()
    const logs: string[] = []
    const nodeLookup = new Map(nodes.map((node) => [node.id, node]))

    while (queue.length > 0) {
      const item = queue.shift()
      if (!item || visited.has(item.id)) continue
      visited.add(item.id)

      const node = nodeLookup.get(item.id)
      if (!node) continue

      setNodes((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? { ...entry, data: { ...entry.data, status: 'running' } }
            : entry,
        ),
      )

      await new Promise((resolve) => window.setTimeout(resolve, 160))

      let output = item.value
      let conditionPassed = true

      switch (node.data.kind) {
        case 'trigger':
          output = 'Workflow started'
          logs.push('Manual trigger started the workflow')
          break
        case 'text':
          output = node.data.text
          logs.push(`Text: ${output || '(empty)'}`)
          break
        case 'condition': {
          const expected = node.data.match.trim().toLocaleLowerCase()
          conditionPassed = expected.length === 0 || item.value.toLocaleLowerCase().includes(expected)
          logs.push(`Condition: ${conditionPassed ? 'matched' : 'not matched'}`)
          break
        }
        case 'log':
          logs.push(`Output: ${item.value || '(empty)'}`)
          break
      }

      setNodes((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? { ...entry, data: { ...entry.data, status: 'success' } }
            : entry,
        ),
      )

      const outgoing = edges.filter((edge) => edge.source === item.id)
      const nextEdges =
        node.data.kind === 'condition'
          ? outgoing.filter((edge) => edge.sourceHandle === (conditionPassed ? 'yes' : 'no'))
          : outgoing

      nextEdges.forEach((edge) => {
        queue.push({ id: edge.target, value: output })
      })
    }

    setRunLogs(logs)
    setIsRunning(false)
    setNotice('Workflow run finished — this is a local preview')
  }

  const visibleKinds = (Object.keys(NODE_INFO) as NodeKind[]).filter((kind) => {
    const query = searchTerm.toLocaleLowerCase()
    return (
      NODE_INFO[kind].title.toLocaleLowerCase().includes(query) ||
      NODE_INFO[kind].description.toLocaleLowerCase().includes(query)
    )
  })

  const groupedKinds = ['Triggers', 'Logic', 'Actions'] as const

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><Workflow size={19} /></div>
          <div className="brand-wordmark">
            <strong>Flow</strong>
            <span>by Orb Technologies</span>
          </div>
        </div>

        <div className="topbar-divider" />

        <div className="workflow-name-wrap">
          <input
            aria-label="Workflow name"
            className="workflow-name"
            maxLength={64}
            onChange={(event) => setWorkflowName(event.target.value)}
            value={workflowName}
          />
          <ChevronDown size={14} />
        </div>

        <div className="topbar-spacer" />

        <div className="save-indicator">
          {savedLocally ? <Check size={14} /> : <Save size={14} />}
          <span>{savedLocally ? 'Saved on this device' : 'Local save unavailable'}</span>
        </div>

        <button className="topbar-button secondary-button" onClick={() => importInputRef.current?.click()} type="button">
          <ArrowUpFromLine size={15} />
          <span>Import</span>
        </button>
        <input
          ref={importInputRef}
          accept="application/json,.json"
          className="visually-hidden"
          onChange={importWorkspace}
          type="file"
        />
        <button className="topbar-button secondary-button" onClick={exportWorkspace} type="button">
          <ArrowDownToLine size={15} />
          <span>Export</span>
        </button>
        <button className="topbar-button new-button" onClick={startNewWorkflow} type="button">
          <Plus size={15} />
          <span>New</span>
        </button>
        <button
          className="topbar-button run-button"
          disabled={isRunning}
          onClick={runWorkflow}
          type="button"
        >
          <Play size={15} fill="currentColor" />
          <span>{isRunning ? 'Running…' : 'Run workflow'}</span>
        </button>
      </header>

      <div className="editor-layout">
        <aside className={`left-sidebar ${mobilePanel === 'blocks' ? 'is-mobile-open' : ''}`}>
          <div className="sidebar-heading">
            <div>
              <span className="eyebrow">BUILD</span>
              <h2>Blocks</h2>
            </div>
            <span className="block-count">{visibleKinds.length}</span>
          </div>

          <label className="search-box">
            <Search size={15} />
            <input
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Find a block..."
              value={searchTerm}
            />
            <kbd>/</kbd>
          </label>

          <div className="palette-list">
            {groupedKinds.map((group) => {
              const items = visibleKinds.filter((kind) => NODE_INFO[kind].category === group)
              if (items.length === 0) return null
              return (
                <section className="palette-group" key={group}>
                  <h3>{group}</h3>
                  {items.map((kind) => (
                    <PaletteItem key={kind} kind={kind} onAdd={addNode} />
                  ))}
                </section>
              )
            })}
            {visibleKinds.length === 0 && <p className="empty-search">No matching blocks.</p>}
          </div>

          <div className="sidebar-tip">
            <div className="tip-icon"><Grip size={15} /></div>
            <div>
              <strong>Drag into canvas</strong>
              <span>Or click a block to add it.</span>
            </div>
          </div>

          <div className="sidebar-footer">
            <span className="orb-status-dot" />
            <span>Flow editor preview</span>
            <button aria-label="Open quick tour" onClick={openOnboarding} type="button">
              <CircleHelp size={15} />
            </button>
          </div>
        </aside>

        <main className="canvas-wrap">
          <div className="canvas-toolbar">
            <div className="canvas-breadcrumb">
              <span>Workspace</span>
              <span className="breadcrumb-separator">/</span>
              <strong>{workflowName || 'Untitled workflow'}</strong>
            </div>
            <div className="canvas-tools">
              <span className="canvas-hint"><MousePointer2 size={13} /> Select and connect blocks</span>
              <button aria-label="Fit workflow to screen" className="icon-button" onClick={() => fitView({ padding: 0.24, duration: 350 })} type="button">
                <Sparkles size={15} />
              </button>
            </div>
          </div>

          <div className="flow-canvas">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, node) => {
                setSelectedNodeId(node.id)
                if (window.matchMedia('(max-width: 640px)').matches) setMobilePanel('settings')
              }}
              onPaneClick={() => {
                setSelectedNodeId(null)
                if (window.matchMedia('(max-width: 640px)').matches) setMobilePanel(null)
              }}
              onDrop={onDrop}
              onDragOver={(event) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
              }}
              defaultEdgeOptions={{
                type: 'smoothstep',
                style: { stroke: '#77859b', strokeWidth: 1.7 },
              }}
              deleteKeyCode={['Backspace', 'Delete']}
              fitView
              fitViewOptions={{ padding: 0.24 }}
              minZoom={0.25}
              maxZoom={1.7}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#253143" gap={22} size={1} variant={BackgroundVariant.Dots} />
              <MiniMap
                nodeColor={(node) => {
                  const data = node.data as FlowNodeData
                  if (data.kind === 'trigger') return '#d29a54'
                  if (data.kind === 'condition') return '#8d79d8'
                  if (data.kind === 'text') return '#4c9eac'
                  return '#6e829c'
                }}
                maskColor="rgba(8, 13, 21, 0.72)"
                pannable
                zoomable
              />
              <Controls showInteractive={false} />
            </ReactFlow>
            {nodes.length === 0 && (
              <div className="empty-canvas">
                <div className="empty-canvas-icon"><Workflow size={23} /></div>
                <h2>Start with a block</h2>
                <p>Drag a block from the left, or click one to add it to your workflow.</p>
                <button className="text-action" onClick={() => addNode('trigger', { x: 120, y: 140 })} type="button">
                  <Plus size={15} /> Add a trigger
                </button>
              </div>
            )}
          </div>

          {runLogs.length > 0 && (
            <div className="run-console">
              <div className="console-heading">
                <span><Activity size={14} /> Latest run</span>
                <button aria-label="Clear run output" onClick={() => setRunLogs([])} type="button"><X size={14} /></button>
              </div>
              <div className="console-lines">
                {runLogs.map((line, index) => <p key={`${index}-${line}`}><span>{String(index + 1).padStart(2, '0')}</span>{line}</p>)}
              </div>
            </div>
          )}
        </main>

        <aside className={`right-sidebar ${mobilePanel === 'settings' ? 'is-mobile-open' : ''}`}>
          {selectedNode ? (
            <>
              <div className="inspector-heading">
                <div>
                  <span className="eyebrow">CONFIGURE</span>
                  <h2>Block settings</h2>
                </div>
                <button aria-label="Close block settings" className="icon-button" onClick={() => { setSelectedNodeId(null); setMobilePanel(null) }} type="button"><X size={16} /></button>
              </div>
              <div className="inspector-content">
                <div className="inspector-type">
                  <span className={`palette-icon node-icon-${selectedNode.data.kind}`}>
                    {(() => {
                      const Icon = NODE_ICONS[selectedNode.data.kind]
                      return <Icon size={17} />
                    })()}
                  </span>
                  <div>
                    <strong>{NODE_INFO[selectedNode.data.kind].title}</strong>
                    <span>{NODE_INFO[selectedNode.data.kind].category}</span>
                  </div>
                </div>

                <label className="field-label">
                  Block name
                  <input
                    className="field-input"
                    maxLength={60}
                    onChange={(event) => updateSelectedNode({ title: event.target.value })}
                    value={selectedNode.data.title}
                  />
                </label>

                {selectedNode.data.kind === 'text' && (
                  <label className="field-label">
                    Text content
                    <textarea
                      className="field-input field-textarea"
                      onChange={(event) => updateSelectedNode({ text: event.target.value })}
                      placeholder="Write the text this block should produce..."
                      rows={5}
                      value={selectedNode.data.text}
                    />
                    <span className="field-help">This value is passed to the next connected block.</span>
                  </label>
                )}

                {selectedNode.data.kind === 'condition' && (
                  <label className="field-label">
                    Text must contain
                    <input
                      className="field-input"
                      onChange={(event) => updateSelectedNode({ match: event.target.value })}
                      placeholder="For example: approved"
                      value={selectedNode.data.match}
                    />
                    <span className="field-help">Connect the YES and NO handles to different paths.</span>
                  </label>
                )}

                {selectedNode.data.kind === 'trigger' && (
                  <div className="info-card">
                    <Zap size={16} />
                    <p>This workflow starts when you press <strong>Run workflow</strong>.</p>
                  </div>
                )}

                {selectedNode.data.kind === 'log' && (
                  <div className="info-card">
                    <Terminal size={16} />
                    <p>When this block runs, the incoming value appears in the run console below the canvas.</p>
                  </div>
                )}

                <div className="inspector-divider" />
                <div className="inspector-meta">
                  <span>Block ID</span>
                  <code>{selectedNode.id}</code>
                </div>
                <button className="delete-button" onClick={deleteSelectedNode} type="button">
                  <Trash2 size={15} /> Delete block
                </button>
              </div>
            </>
          ) : (
            <div className="inspector-empty">
              <div className="inspector-empty-icon"><Code2 size={20} /></div>
              <h3>Nothing selected</h3>
              <p>Select a block on the canvas to edit its settings.</p>
              <div className="shortcut-card">
                <div><Keyboard size={14} /> <span>Quick tip</span></div>
                <p>Connect blocks by dragging from a small handle on one block to another.</p>
              </div>
            </div>
          )}
        </aside>
      </div>

      <nav className="mobile-dock" aria-label="Mobile editor tools">
        <button className={mobilePanel === 'blocks' ? 'is-active' : ''} onClick={() => setMobilePanel(mobilePanel === 'blocks' ? null : 'blocks')} type="button">
          <Grip size={17} /><span>Blocks</span>
        </button>
        <button className={mobilePanel === 'settings' ? 'is-active' : ''} onClick={() => setMobilePanel(mobilePanel === 'settings' ? null : 'settings')} type="button">
          <Code2 size={17} /><span>Settings</span>
        </button>
        <button onClick={startNewWorkflow} type="button">
          <Plus size={17} /><span>New</span>
        </button>
        <button onClick={openOnboarding} type="button">
          <CircleHelp size={17} /><span>Tour</span>
        </button>
      </nav>

      {showOnboarding && <OnboardingWizard onClose={finishOnboarding} />}

      {notice && <div className="toast-message" role="status">{notice}</div>}
    </div>
  )
}

export default function App() {
  return (
    <ReactFlowProvider>
      <FlowEditor />
    </ReactFlowProvider>
  )
}
