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
  Braces,
  Globe2,
  Maximize2,
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
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
  Terminal,
  Trash2,
  Type,
  Workflow,
  X,
  Zap,
} from 'lucide-react'

type NodeKind = 'trigger' | 'text' | 'condition' | 'variable' | 'http' | 'log'
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
type RunStatus = 'idle' | 'running' | 'success' | 'error'
type MobilePanel = 'blocks' | 'settings' | null

type FlowNodeData = {
  kind: NodeKind
  title: string
  description: string
  text: string
  match: string
  variableName: string
  variableValue: string
  requestMethod: HttpMethod
  requestUrl: string
  requestHeaders: string
  requestBody: string
  timeoutMs: number
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
  variable: {
    title: 'Set variable',
    description: 'Save a named value for later blocks.',
    category: 'Actions',
  },
  http: {
    title: 'HTTP request',
    description: 'Send a web request and pass its response onward.',
    category: 'Actions',
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
  variable: Braces,
  http: Globe2,
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
      variableName: 'message',
      variableValue: '{{input}}',
      requestMethod: 'GET',
      requestUrl: 'https://jsonplaceholder.typicode.com/todos/1',
      requestHeaders: '{\n  "Accept": "application/json"\n}',
      requestBody: '{\n  "message": "{{input}}"\n}',
      timeoutMs: 10000,
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

function normalizeWorkspace(value: unknown): SavedWorkspace | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = value as Record<string, unknown>
  if (
    candidate.version !== 1 ||
    !Array.isArray(candidate.nodes) ||
    !Array.isArray(candidate.edges) ||
    typeof candidate.name !== 'string' ||
    candidate.nodes.length > 500 ||
    candidate.edges.length > 1000
  ) {
    return null
  }

  const nodes: FlowNode[] = []
  const nodeIds = new Set<string>()

  for (const rawNode of candidate.nodes) {
    if (!rawNode || typeof rawNode !== 'object' || Array.isArray(rawNode)) return null
    const item = rawNode as Record<string, unknown>
    const position = item.position
    const data = item.data
    if (
      typeof item.id !== 'string' ||
      item.id.length === 0 ||
      item.id.length > 120 ||
      nodeIds.has(item.id) ||
      !position ||
      typeof position !== 'object' ||
      Array.isArray(position) ||
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data)
    ) {
      return null
    }

    const point = position as Record<string, unknown>
    const settings = data as Record<string, unknown>
    const kind = settings.kind
    if (
      typeof point.x !== 'number' ||
      !Number.isFinite(point.x) ||
      typeof point.y !== 'number' ||
      !Number.isFinite(point.y) ||
      typeof kind !== 'string' ||
      !Object.hasOwn(NODE_INFO, kind)
    ) {
      return null
    }

    const nodeKind = kind as NodeKind
    nodeIds.add(item.id)
    nodes.push({
      id: item.id,
      type: 'flowNode',
      position: { x: point.x, y: point.y },
      data: {
        kind: nodeKind,
        title: typeof settings.title === 'string' ? settings.title.slice(0, 60) : NODE_INFO[nodeKind].title,
        description: NODE_INFO[nodeKind].description,
        text: typeof settings.text === 'string' ? settings.text.slice(0, 20000) : '',
        match: typeof settings.match === 'string' ? settings.match.slice(0, 500) : '',
        variableName:
          typeof settings.variableName === 'string' && /^[A-Za-z_][A-Za-z0-9_]{0,39}$/.test(settings.variableName)
            ? settings.variableName
            : 'message',
        variableValue: typeof settings.variableValue === 'string' ? settings.variableValue.slice(0, 20000) : '{{input}}',
        requestMethod: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(String(settings.requestMethod))
          ? settings.requestMethod as HttpMethod
          : 'GET',
        requestUrl: typeof settings.requestUrl === 'string' ? settings.requestUrl.slice(0, 2000) : '',
        requestHeaders: typeof settings.requestHeaders === 'string' ? settings.requestHeaders.slice(0, 10000) : '{}',
        requestBody: typeof settings.requestBody === 'string' ? settings.requestBody.slice(0, 20000) : '',
        timeoutMs:
          typeof settings.timeoutMs === 'number' && Number.isFinite(settings.timeoutMs)
            ? Math.min(30000, Math.max(1000, Math.round(settings.timeoutMs)))
            : 10000,
        status: 'idle',
      },
    })
  }

  const edges: Edge[] = []
  const edgeIds = new Set<string>()
  const edgeKeys = new Set<string>()

  for (const rawEdge of candidate.edges) {
    if (!rawEdge || typeof rawEdge !== 'object' || Array.isArray(rawEdge)) return null
    const item = rawEdge as Record<string, unknown>
    if (
      typeof item.id !== 'string' ||
      item.id.length === 0 ||
      item.id.length > 160 ||
      edgeIds.has(item.id) ||
      typeof item.source !== 'string' ||
      typeof item.target !== 'string' ||
      !nodeIds.has(item.source) ||
      !nodeIds.has(item.target)
    ) {
      return null
    }

    const sourceNode = nodes.find((node) => node.id === item.source)
    const sourceHandle = typeof item.sourceHandle === 'string' ? item.sourceHandle : undefined
    const targetHandle = typeof item.targetHandle === 'string' ? item.targetHandle : undefined
    if (
      sourceNode?.data.kind === 'condition' &&
      sourceHandle !== 'yes' &&
      sourceHandle !== 'no'
    ) {
      return null
    }

    const edgeKey = `${item.source}:${sourceHandle ?? ''}:${item.target}`
    if (edgeKeys.has(edgeKey)) return null
    edgeIds.add(item.id)
    edgeKeys.add(edgeKey)
    edges.push({
      id: item.id,
      source: item.source,
      target: item.target,
      type: 'smoothstep',
      ...(sourceHandle ? { sourceHandle } : {}),
      ...(targetHandle ? { targetHandle } : {}),
      animated: false,
    })
  }

  return {
    version: 1,
    name: candidate.name.slice(0, 64),
    nodes,
    edges,
  }
}

function resolveTemplate(
  template: string,
  input: string,
  variables: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, (_match, name: string) => {
    if (name === 'input') return input
    if (!Object.hasOwn(variables, name)) {
      throw new Error(`Variable "{{${name}}}" has not been set.`)
    }
    return variables[name]
  })
}

async function readResponsePreview(response: Response, maxCharacters = 50000): Promise<string> {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let result = ''
  let truncated = false

  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      result += decoder.decode(chunk.value, { stream: true })
      if (result.length > maxCharacters) {
        result = result.slice(0, maxCharacters)
        truncated = true
        await reader.cancel().catch(() => undefined)
        break
      }
    }
    result += decoder.decode()
  } finally {
    reader.releaseLock()
  }

  return truncated ? `${result}\n… response truncated at 50 KB` : result
}

function hasDirectedCycle(nodes: FlowNode[], edges: Edge[]): boolean {
  const indegree = new Map(nodes.map((node) => [node.id, 0]))
  const outgoing = new Map<string, string[]>()
  for (const edge of edges) {
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1)
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target])
  }

  const queue = nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id)
  let visitedCount = 0
  while (queue.length > 0) {
    const id = queue.shift()
    if (!id) continue
    visitedCount += 1
    for (const target of outgoing.get(id) ?? []) {
      const next = (indegree.get(target) ?? 0) - 1
      indegree.set(target, next)
      if (next === 0) queue.push(target)
    }
  }
  return visitedCount !== nodes.length
}

function loadWorkspace(): SavedWorkspace {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = normalizeWorkspace(JSON.parse(raw) as unknown)
      if (parsed) return parsed
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
        {data.kind === 'variable' && (
          <div className="node-preview">{`{{${data.variableName}}} = ${data.variableValue || '(empty)'}`}</div>
        )}
        {data.kind === 'http' && (
          <div className="node-preview">{data.requestMethod} · {data.requestUrl}</div>
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
  const searchInputRef = useRef<HTMLInputElement>(null)
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

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target
      const isTyping =
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

      if (event.key === '/' && !isTyping && !event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
      if (event.key === 'Escape') {
        setMobilePanel(null)
      }
    }

    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

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
    if (nodes.length > 0 && !window.confirm('Start a new workflow? This replaces the current editor contents. Export first if you want to keep a separate copy.')) {
      return
    }
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
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setNotice('Workflow exported')
  }

  const importWorkspace = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('Workflow files must be smaller than 2 MB.')
      }
      const parsed = normalizeWorkspace(JSON.parse(await file.text()) as unknown)
      if (!parsed) {
        throw new Error('This file is not a valid Flow workflow or contains unsupported blocks.')
      }
      if (nodes.length > 0 && !window.confirm('Import this workflow and replace the current editor contents? Export first if you want to keep a separate copy.')) {
        return
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

    if (hasDirectedCycle(nodes, edges)) {
      setNotice('This preview cannot run workflows with loops. Remove the cycle and try again.')
      return
    }

    const containsHttpRequest = nodes.some((node) => node.data.kind === 'http')
    if (
      containsHttpRequest &&
      !window.confirm(
        'This workflow contains an HTTP Request block. Running it sends network requests to the configured URLs. Do not include passwords, API keys, personal data or other secrets. Continue?',
      )
    ) {
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
    const variables: Record<string, string> = Object.create(null) as Record<string, string>
    const nodeLookup = new Map(nodes.map((node) => [node.id, node]))
    let activeNodeId: string | null = null

    try {
      while (queue.length > 0) {
        const item = queue.shift()
        if (!item || visited.has(item.id)) continue
        visited.add(item.id)

        const node = nodeLookup.get(item.id)
        if (!node) continue
        activeNodeId = item.id

        setNodes((current) =>
          current.map((entry) =>
            entry.id === item.id
              ? { ...entry, data: { ...entry.data, status: 'running' } }
              : entry,
          ),
        )

        let output = item.value
        let conditionPassed = true

        try {
          switch (node.data.kind) {
            case 'trigger':
              output = 'Workflow started'
              logs.push('Manual trigger started the workflow')
              break

            case 'text':
              output = resolveTemplate(node.data.text, item.value, variables)
              logs.push(`Text block completed (${output.length} characters)`)
              break

            case 'variable': {
              const name = node.data.variableName.trim()
              if (!/^[A-Za-z_][A-Za-z0-9_]{0,39}$/.test(name) || name === 'input') {
                throw new Error('Variable names must start with a letter or underscore and cannot be "input".')
              }
              variables[name] = resolveTemplate(node.data.variableValue, item.value, variables)
              logs.push(`Variable set: {{${name}}}`)
              break
            }

            case 'condition': {
              const expected = node.data.match.trim().toLocaleLowerCase()
              conditionPassed =
                expected.length === 0 || item.value.toLocaleLowerCase().includes(expected)
              logs.push(`Condition: ${conditionPassed ? 'matched' : 'not matched'}`)
              break
            }

            case 'http': {
              const target = new URL(resolveTemplate(node.data.requestUrl.trim(), item.value, variables))
              if (!['http:', 'https:'].includes(target.protocol)) {
                throw new Error('HTTP Request only supports http:// and https:// URLs.')
              }
              if (target.username || target.password) {
                throw new Error('Do not put usernames or passwords inside a request URL.')
              }

              const parsedHeaders: unknown = JSON.parse(
                resolveTemplate(node.data.requestHeaders || '{}', item.value, variables),
              )
              if (!parsedHeaders || typeof parsedHeaders !== 'object' || Array.isArray(parsedHeaders)) {
                throw new Error('Request headers must be a JSON object.')
              }

              const headers = new Headers()
              for (const [name, value] of Object.entries(parsedHeaders)) {
                if (typeof value !== 'string') {
                  throw new Error(`Header "${name}" must have a text value.`)
                }
                if (/(authorization|auth|cookie|api[-_]?key|token|password|secret)/i.test(name)) {
                  throw new Error(`Credential header "${name}" is disabled until secure credential storage is available.`)
                }
                headers.set(name, resolveTemplate(value, item.value, variables))
              }

              const controller = new AbortController()
              const timeout = window.setTimeout(
                () => controller.abort(),
                Math.min(30000, Math.max(1000, node.data.timeoutMs || 10000)),
              )

              try {
                const requestInit: RequestInit = {
                  method: node.data.requestMethod,
                  headers,
                  signal: controller.signal,
                }
                if (!['GET'].includes(node.data.requestMethod)) {
                  requestInit.body = resolveTemplate(node.data.requestBody, item.value, variables)
                }

                logs.push(`HTTP ${node.data.requestMethod} ${target.host}${target.pathname}`)
                setRunLogs([...logs])
                const response = await fetch(target.toString(), requestInit)
                output = await readResponsePreview(response)
                logs.push(`Response: ${response.status} ${response.statusText}`)
                if (!response.ok) {
                  throw new Error(`Request returned HTTP ${response.status} ${response.statusText}.`)
                }
                logs.push(`Response body: ${output.slice(0, 180).replace(/\s+/g, ' ')}`)
              } catch (error) {
                if (error instanceof Error && error.name === 'AbortError') {
                  throw new Error('HTTP request timed out. Increase the timeout or check the endpoint.')
                }
                if (error instanceof TypeError) {
                  throw new Error('Network request failed. Check the URL, connection and endpoint CORS policy.')
                }
                throw error
              } finally {
                window.clearTimeout(timeout)
              }
              break
            }

            case 'log':
              logs.push(`Output: ${item.value || '(empty)'}`)
              break
          }
        } catch (error) {
          setNodes((current) =>
            current.map((entry) =>
              entry.id === item.id
                ? { ...entry, data: { ...entry.data, status: 'error' } }
                : entry,
            ),
          )
          throw error
        }

        setNodes((current) =>
          current.map((entry) =>
            entry.id === item.id
              ? { ...entry, data: { ...entry.data, status: 'success' } }
              : entry,
          ),
        )
        setRunLogs([...logs])

        const outgoing = edges.filter((edge) => edge.source === item.id)
        const nextEdges =
          node.data.kind === 'condition'
            ? outgoing.filter((edge) => edge.sourceHandle === (conditionPassed ? 'yes' : 'no'))
            : outgoing

        nextEdges.forEach((edge) => {
          queue.push({ id: edge.target, value: output })
        })
        activeNodeId = null
      }

      setRunLogs(logs)
      setNotice('Workflow preview completed.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown error stopped the workflow.'
      if (activeNodeId) {
        setNodes((current) =>
          current.map((entry) =>
            entry.id === activeNodeId
              ? { ...entry, data: { ...entry.data, status: 'error' } }
              : entry,
          ),
        )
      }
      logs.push(`Run stopped: ${message}`)
      setRunLogs([...logs])
      setNotice(`Workflow stopped: ${message}`)
    } finally {
      setIsRunning(false)
    }
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
          <span>{isRunning ? 'Running…' : 'Preview workflow'}</span>
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
              aria-label="Find a block"
              placeholder="Find a block..."
              ref={searchInputRef}
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
                <Maximize2 size={15} />
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
                  if (data.kind === 'variable') return '#6eae9b'
                  if (data.kind === 'http') return '#4e9eae'
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
                    <span className="field-help">Use {'{{input}}'} for the incoming value or {'{{variableName}}'} for a variable set earlier in the workflow.</span>
                  </label>
                )}

                {selectedNode.data.kind === 'variable' && (
                  <>
                    <label className="field-label">
                      Variable name
                      <input
                        className="field-input"
                        maxLength={40}
                        onChange={(event) => updateSelectedNode({ variableName: event.target.value })}
                        placeholder="customerName"
                        value={selectedNode.data.variableName}
                      />
                    </label>
                    <label className="field-label">
                      Value
                      <textarea
                        className="field-input field-textarea"
                        onChange={(event) => updateSelectedNode({ variableValue: event.target.value })}
                        placeholder="For example: {{input}}"
                        rows={4}
                        value={selectedNode.data.variableValue}
                      />
                      <span className="field-help">Later blocks can use this value as {'{{variableName}}'}. The original input continues to the next block.</span>
                    </label>
                  </>
                )}

                {selectedNode.data.kind === 'http' && (
                  <>
                    <label className="field-label">
                      Method
                      <select
                        className="field-input"
                        onChange={(event) => updateSelectedNode({ requestMethod: event.target.value as HttpMethod })}
                        value={selectedNode.data.requestMethod}
                      >
                        {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as HttpMethod[]).map((method) => (
                          <option key={method} value={method}>{method}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field-label">
                      Request URL
                      <input
                        className="field-input"
                        maxLength={2000}
                        onChange={(event) => updateSelectedNode({ requestUrl: event.target.value })}
                        placeholder="https://api.example.com/items"
                        value={selectedNode.data.requestUrl}
                      />
                      <span className="field-help">Use {'{{input}}'} or {'{{variableName}}'} in the URL. Only HTTP and HTTPS addresses are supported.</span>
                    </label>
                    <label className="field-label">
                      Headers (JSON)
                      <textarea
                        className="field-input field-textarea"
                        onChange={(event) => updateSelectedNode({ requestHeaders: event.target.value })}
                        placeholder={'{\n  "Accept": "application/json"\n}'}
                        rows={4}
                        value={selectedNode.data.requestHeaders}
                      />
                      <span className="field-help">Credential headers are disabled. Do not put API keys, passwords or private data in workflows.</span>
                    </label>
                    {!['GET'].includes(selectedNode.data.requestMethod) && (
                      <label className="field-label">
                        Request body
                        <textarea
                          className="field-input field-textarea"
                          onChange={(event) => updateSelectedNode({ requestBody: event.target.value })}
                          placeholder={'{\n  "message": "{{input}}"\n}'}
                          rows={5}
                          value={selectedNode.data.requestBody}
                        />
                      </label>
                    )}
                    <label className="field-label">
                      Timeout
                      <select
                        className="field-input"
                        onChange={(event) => updateSelectedNode({ timeoutMs: Number(event.target.value) })}
                        value={String(selectedNode.data.timeoutMs)}
                      >
                        <option value="5000">5 seconds</option>
                        <option value="10000">10 seconds</option>
                        <option value="20000">20 seconds</option>
                        <option value="30000">30 seconds</option>
                      </select>
                    </label>
                    <div className="info-card">
                      <Globe2 size={16} />
                      <p>Requests are sent from this device after you confirm a workflow run. Some services block browser requests unless they enable CORS. Flow does not bypass those restrictions.</p>
                    </div>
                  </>
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
                    <p>This workflow starts when you press <strong>Preview workflow</strong>.</p>
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
