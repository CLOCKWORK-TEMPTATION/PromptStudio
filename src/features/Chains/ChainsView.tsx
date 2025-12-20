import { useState, useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MarkerType,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  GitBranch,
  Plus,
  Play,
  Save,
  Trash2,
  PenTool,
  GitMerge,
  Repeat,
  ArrowRightCircle,
  ArrowLeftCircle,
  Zap,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import clsx from 'clsx';

const nodeTypes = {
  prompt: PromptNode,
  condition: ConditionNode,
  input: InputNode,
  output: OutputNode,
  transform: TransformNode,
};

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'input',
    position: { x: 100, y: 200 },
    data: { label: 'Input' },
  },
  {
    id: '2',
    type: 'prompt',
    position: { x: 350, y: 200 },
    data: { label: 'Process Input', prompt: 'Analyze the input and extract key information' },
  },
  {
    id: '3',
    type: 'output',
    position: { x: 600, y: 200 },
    data: { label: 'Output' },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e2-3', source: '2', target: '3', markerEnd: { type: MarkerType.ArrowClosed } },
];

export function ChainsView() {
  const { theme } = useAppStore();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [chainName, setChainName] = useState('My Chain');

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed } }, eds)),
    [setEdges]
  );

  const addNode = (type: string) => {
    const newNode: Node = {
      id: `${Date.now()}`,
      type,
      position: { x: Math.random() * 400 + 200, y: Math.random() * 300 + 100 },
      data: {
        label: type === 'prompt' ? 'New Prompt' : type === 'condition' ? 'Condition' : type === 'transform' ? 'Transform' : type.charAt(0).toUpperCase() + type.slice(1),
        prompt: type === 'prompt' ? '' : undefined,
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const deleteSelectedNode = () => {
    if (selectedNode) {
      setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
      setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
      setSelectedNode(null);
    }
  };

  const runChain = async () => {
    setIsRunning(true);

    for (const node of nodes) {
      setNodes((nds) =>
        nds.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, status: 'running' } } : n))
      );
      await new Promise((resolve) => setTimeout(resolve, 500));
      setNodes((nds) =>
        nds.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, status: 'success' } } : n))
      );
    }

    setIsRunning(false);
  };

  return (
    <div className="h-full flex flex-col">
      <div className={clsx(
        'px-6 py-4 border-b flex items-center justify-between',
        theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
      )}>
        <div className="flex items-center gap-4">
          <GitBranch className={clsx('w-6 h-6', theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600')} />
          <input
            type="text"
            value={chainName}
            onChange={(e) => setChainName(e.target.value)}
            className={clsx(
              'text-xl font-semibold bg-transparent border-none outline-none',
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={runChain}
            disabled={isRunning}
            className={clsx(
              'px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors',
              theme === 'dark'
                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50'
                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-50'
            )}
          >
            <Play className="w-4 h-4" />
            {isRunning ? 'Running...' : 'Run Chain'}
          </button>
          <button
            className={clsx(
              'px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors',
              theme === 'dark'
                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>

      <div className="flex-1 flex">
        <aside className={clsx(
          'w-64 border-r p-4 space-y-4',
          theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
        )}>
          <h3 className={clsx('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Add Node
          </h3>

          <div className="space-y-2">
            {[
              { type: 'prompt', label: 'Prompt', icon: PenTool, color: 'emerald' },
              { type: 'condition', label: 'Condition', icon: GitMerge, color: 'amber' },
              { type: 'transform', label: 'Transform', icon: Zap, color: 'blue' },
              { type: 'input', label: 'Input', icon: ArrowRightCircle, color: 'cyan' },
              { type: 'output', label: 'Output', icon: ArrowLeftCircle, color: 'rose' },
            ].map((nodeType) => (
              <button
                key={nodeType.type}
                onClick={() => addNode(nodeType.type)}
                className={clsx(
                  'w-full px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors',
                  theme === 'dark'
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                <nodeType.icon className="w-4 h-4" />
                {nodeType.label}
              </button>
            ))}
          </div>

          {selectedNode && (
            <div className={clsx(
              'pt-4 border-t',
              theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
            )}>
              <h3 className={clsx('font-medium mb-3', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Selected: {selectedNode.data.label}
              </h3>

              {selectedNode.type === 'prompt' && (
                <textarea
                  value={selectedNode.data.prompt || ''}
                  onChange={(e) => {
                    setNodes((nds) =>
                      nds.map((n) =>
                        n.id === selectedNode.id
                          ? { ...n, data: { ...n.data, prompt: e.target.value } }
                          : n
                      )
                    );
                  }}
                  placeholder="Enter prompt..."
                  rows={4}
                  className={clsx(
                    'w-full px-3 py-2 rounded-lg border text-sm resize-none',
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-700 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  )}
                />
              )}

              <button
                onClick={deleteSelectedNode}
                className={clsx(
                  'w-full mt-3 px-3 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors',
                  theme === 'dark'
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                )}
              >
                <Trash2 className="w-4 h-4" />
                Delete Node
              </button>
            </div>
          )}
        </aside>

        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNode(node)}
            onPaneClick={() => setSelectedNode(null)}
            nodeTypes={nodeTypes}
            fitView
            className={theme === 'dark' ? 'bg-gray-950' : 'bg-gray-50'}
          >
            <Controls className={theme === 'dark' ? '[&>button]:bg-gray-800 [&>button]:border-gray-700' : ''} />
            <Background color={theme === 'dark' ? '#374151' : '#d1d5db'} gap={16} />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

function PromptNode({ data }: { data: { label: string; prompt?: string; status?: string } }) {
  const { theme } = useAppStore();

  return (
    <div className={clsx(
      'px-4 py-3 rounded-lg border-2 min-w-[150px]',
      data.status === 'running' && 'animate-pulse',
      data.status === 'success'
        ? 'border-emerald-500 bg-emerald-500/20'
        : theme === 'dark'
          ? 'border-emerald-500/50 bg-gray-800'
          : 'border-emerald-400 bg-white'
    )}>
      <div className="flex items-center gap-2">
        <PenTool className={clsx('w-4 h-4', theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600')} />
        <span className={clsx('font-medium text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          {data.label}
        </span>
      </div>
      {data.prompt && (
        <p className={clsx('text-xs mt-1 truncate max-w-[120px]', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
          {data.prompt}
        </p>
      )}
    </div>
  );
}

function ConditionNode({ data }: { data: { label: string; status?: string } }) {
  const { theme } = useAppStore();

  return (
    <div className={clsx(
      'px-4 py-3 rounded-lg border-2 min-w-[120px]',
      data.status === 'success'
        ? 'border-amber-500 bg-amber-500/20'
        : theme === 'dark'
          ? 'border-amber-500/50 bg-gray-800'
          : 'border-amber-400 bg-white'
    )}>
      <div className="flex items-center gap-2">
        <GitMerge className={clsx('w-4 h-4', theme === 'dark' ? 'text-amber-400' : 'text-amber-600')} />
        <span className={clsx('font-medium text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          {data.label}
        </span>
      </div>
    </div>
  );
}

function InputNode({ data }: { data: { label: string; status?: string } }) {
  const { theme } = useAppStore();

  return (
    <div className={clsx(
      'px-4 py-3 rounded-lg border-2 min-w-[100px]',
      data.status === 'success'
        ? 'border-cyan-500 bg-cyan-500/20'
        : theme === 'dark'
          ? 'border-cyan-500/50 bg-gray-800'
          : 'border-cyan-400 bg-white'
    )}>
      <div className="flex items-center gap-2">
        <ArrowRightCircle className={clsx('w-4 h-4', theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600')} />
        <span className={clsx('font-medium text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          {data.label}
        </span>
      </div>
    </div>
  );
}

function OutputNode({ data }: { data: { label: string; status?: string } }) {
  const { theme } = useAppStore();

  return (
    <div className={clsx(
      'px-4 py-3 rounded-lg border-2 min-w-[100px]',
      data.status === 'success'
        ? 'border-rose-500 bg-rose-500/20'
        : theme === 'dark'
          ? 'border-rose-500/50 bg-gray-800'
          : 'border-rose-400 bg-white'
    )}>
      <div className="flex items-center gap-2">
        <ArrowLeftCircle className={clsx('w-4 h-4', theme === 'dark' ? 'text-rose-400' : 'text-rose-600')} />
        <span className={clsx('font-medium text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          {data.label}
        </span>
      </div>
    </div>
  );
}

function TransformNode({ data }: { data: { label: string; status?: string } }) {
  const { theme } = useAppStore();

  return (
    <div className={clsx(
      'px-4 py-3 rounded-lg border-2 min-w-[120px]',
      data.status === 'success'
        ? 'border-blue-500 bg-blue-500/20'
        : theme === 'dark'
          ? 'border-blue-500/50 bg-gray-800'
          : 'border-blue-400 bg-white'
    )}>
      <div className="flex items-center gap-2">
        <Zap className={clsx('w-4 h-4', theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
        <span className={clsx('font-medium text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          {data.label}
        </span>
      </div>
    </div>
  );
}
