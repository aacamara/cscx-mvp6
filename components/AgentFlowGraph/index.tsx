/**
 * Agent Flow Graph
 * Interactive visualization of agent execution using React Flow
 * Shows real-time agent steps, tool calls, and decision paths
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// ============================================
// Types
// ============================================

interface FlowVisualization {
  nodes: Array<{
    id: string;
    type: string;
    label: string;
    status: string;
    data: Record<string, any>;
  }>;
  edges: Array<{
    source: string;
    target: string;
    label?: string;
  }>;
}

interface Props {
  runId: string;
  visualization?: FlowVisualization;
  isLive?: boolean;
  onNodeClick?: (nodeId: string, data: any) => void;
}

// ============================================
// Custom Node Components
// ============================================

const nodeColors: Record<string, { bg: string; border: string; icon: string }> = {
  input: { bg: '#22c55e', border: '#16a34a', icon: '📥' },
  output: { bg: '#22c55e', border: '#16a34a', icon: '📤' },
  thinking: { bg: '#3b82f6', border: '#2563eb', icon: '🧠' },
  llm_call: { bg: '#8b5cf6', border: '#7c3aed', icon: '🤖' },
  tool_call: { bg: '#f59e0b', border: '#d97706', icon: '🔧' },
  tool_result: { bg: '#06b6d4', border: '#0891b2', icon: '📊' },
  decision: { bg: '#ec4899', border: '#db2777', icon: '🔀' },
  handoff: { bg: '#14b8a6', border: '#0d9488', icon: '🤝' },
  approval: { bg: '#eab308', border: '#ca8a04', icon: '✋' },
  error: { bg: '#ef4444', border: '#dc2626', icon: '❌' },
  response: { bg: '#22c55e', border: '#16a34a', icon: '✅' },
};

function CustomNode({ data }: { data: any }) {
  const colors = nodeColors[data.type] || { bg: '#6b7280', border: '#4b5563', icon: '•' };
  const isActive = data.status === 'running';
  const isError = data.type === 'error' || data.status === 'error';

  return (
    <div
      className={`px-4 py-3 rounded-lg shadow-lg min-w-[180px] max-w-[280px] transition-all ${
        isActive ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-900' : ''
      }`}
      style={{
        backgroundColor: isError ? '#7f1d1d' : '#1f2937',
        borderWidth: 2,
        borderColor: colors.border,
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{colors.icon}</span>
        <span className="font-medium text-white text-sm truncate">{data.label}</span>
        {isActive && (
          <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse ml-auto" />
        )}
      </div>
      <div className="text-xs text-gray-400">{data.type}</div>
      {data.duration && (
        <div className="text-xs text-gray-500 mt-1">{data.duration}ms</div>
      )}
      {data.tokens && (
        <div className="text-xs text-gray-500">
          {data.tokens.input + data.tokens.output} tokens
        </div>
      )}
    </div>
  );
}

const nodeTypes = {
  custom: CustomNode,
};

// ============================================
// Main Component
// ============================================

export function AgentFlowGraph({ runId, visualization, isLive, onNodeClick }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Convert visualization data to React Flow format
  useEffect(() => {
    if (!visualization) return;

    // Calculate node positions using a simple vertical layout
    const flowNodes: Node[] = visualization.nodes.map((node, index) => {
      // Determine column based on node type for parallel branches
      let xOffset = 0;
      if (node.type === 'tool_call' || node.type === 'tool_result') {
        // Offset tool nodes to show parallel execution
        const toolIndex = visualization.nodes
          .slice(0, index)
          .filter(n => n.type === 'tool_call' || n.type === 'tool_result')
          .length;
        xOffset = (toolIndex % 2 === 0 ? -1 : 1) * 150;
      }

      return {
        id: node.id,
        type: 'custom',
        position: { x: 300 + xOffset, y: index * 120 },
        data: {
          label: node.label,
          type: node.type,
          status: node.status,
          ...node.data,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      };
    });

    const flowEdges: Edge[] = visualization.edges.map((edge, index) => ({
      id: `edge-${index}`,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      animated: isLive,
      style: { stroke: '#6b7280', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#6b7280',
      },
      labelStyle: { fill: '#9ca3af', fontSize: 10 },
      labelBgStyle: { fill: '#1f2937' },
    }));

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [visualization, isLive, setNodes, setEdges]);

  // Handle node click
  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node.id);
    if (onNodeClick) {
      onNodeClick(node.id, node.data);
    }
  }, [onNodeClick]);

  // Custom edge styling for different edge types
  const edgeOptions = useMemo(() => ({
    style: { strokeWidth: 2, stroke: '#6b7280' },
    markerEnd: {
      type: MarkerType.ArrowClosed as const,
      color: '#6b7280',
    },
  }), []);

  if (!visualization || visualization.nodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900 rounded-lg">
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-4">🔀</div>
          <p>No flow data available</p>
          <p className="text-sm mt-2">Run an agent to see the execution flow</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-gray-900 rounded-lg overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={edgeOptions}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        attributionPosition="bottom-left"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#374151"
        />
        <Controls
          className="bg-gray-800 border-gray-700"
          showInteractive={false}
        />
        <MiniMap
          className="bg-gray-800 border-gray-700"
          nodeColor={(node) => {
            const colors = nodeColors[node.data?.type as string];
            return colors?.bg || '#6b7280';
          }}
          maskColor="rgba(0, 0, 0, 0.8)"
        />
      </ReactFlow>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-gray-800/90 backdrop-blur rounded-lg p-3 border border-gray-700">
        <div className="text-xs text-gray-400 mb-2 font-medium">Legend</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {Object.entries(nodeColors).slice(0, 8).map(([type, colors]) => (
            <div key={type} className="flex items-center gap-2 text-xs">
              <span>{colors.icon}</span>
              <span className="text-gray-300 capitalize">{type.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Live indicator */}
      {isLive && (
        <div className="absolute top-4 right-4 flex items-center gap-2 bg-blue-600/90 backdrop-blur px-3 py-1.5 rounded-full">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <span className="text-xs text-white font-medium">Live</span>
        </div>
      )}
    </div>
  );
}

export default AgentFlowGraph;
