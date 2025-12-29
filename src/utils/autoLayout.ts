// utils/autoLayout.ts
import { Table, Relationship } from '@/types/database';

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
}

export const autoLayout = (
  tables: Table[],
  relationships: Relationship[]
): Table[] => {
  if (tables.length === 0) return tables;

  // Calculate table dimensions
  const tableWidth = 280;
  const getTableHeight = (table: Table) => 50 + table.columns.length * 35 + 50;

  // Initialize nodes with physics properties
  const nodes: LayoutNode[] = tables.map(table => ({
    id: table.id,
    x: table.x,
    y: table.y,
    width: tableWidth,
    height: getTableHeight(table),
    vx: 0,
    vy: 0
  }));

  // Force-directed layout parameters
  const iterations = 100;
  const repulsionForce = 50000;
  const attractionForce = 0.01;
  const damping = 0.9;
  const minDistance = 100;

  // Build adjacency map for connected tables
  const connections = new Map<string, Set<string>>();
  relationships.forEach(rel => {
    if (!connections.has(rel.fromTableId)) {
      connections.set(rel.fromTableId, new Set());
    }
    if (!connections.has(rel.toTableId)) {
      connections.set(rel.toTableId, new Set());
    }
    connections.get(rel.fromTableId)!.add(rel.toTableId);
    connections.get(rel.toTableId)!.add(rel.fromTableId);
  });

  // Run physics simulation
  for (let iter = 0; iter < iterations; iter++) {
    // Calculate forces
    for (let i = 0; i < nodes.length; i++) {
      const nodeA = nodes[i];
      let fx = 0;
      let fy = 0;

      // Repulsion from all other nodes
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const nodeB = nodes[j];

        const dx = nodeA.x - nodeB.x;
        const dy = nodeA.y - nodeB.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;

        if (distance < minDistance * 3) {
          const force = repulsionForce / (distance * distance);
          fx += (dx / distance) * force;
          fy += (dy / distance) * force;
        }
      }

      // Attraction to connected nodes
      const connected = connections.get(nodeA.id);
      if (connected) {
        connected.forEach(targetId => {
          const nodeB = nodes.find(n => n.id === targetId);
          if (!nodeB) return;

          const dx = nodeB.x - nodeA.x;
          const dy = nodeB.y - nodeA.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;

          const force = distance * attractionForce;
          fx += (dx / distance) * force;
          fy += (dy / distance) * force;
        });
      }

      // Update velocity and position
      nodeA.vx = (nodeA.vx + fx) * damping;
      nodeA.vy = (nodeA.vy + fy) * damping;
      nodeA.x += nodeA.vx;
      nodeA.y += nodeA.vy;
    }
  }

  // Normalize positions to start from (100, 100)
  const minX = Math.min(...nodes.map(n => n.x));
  const minY = Math.min(...nodes.map(n => n.y));

  // Update table positions
  return tables.map(table => {
    const node = nodes.find(n => n.id === table.id);
    if (!node) return table;

    return {
      ...table,
      x: Math.round(node.x - minX + 100),
      y: Math.round(node.y - minY + 100)
    };
  });
};

export const gridLayout = (tables: Table[]): Table[] => {
  const cols = Math.ceil(Math.sqrt(tables.length));
  const spacing = 400;

  return tables.map((table, index) => ({
    ...table,
    x: 100 + (index % cols) * spacing,
    y: 100 + Math.floor(index / cols) * spacing
  }));
};

export const hierarchicalLayout = (
  tables: Table[],
  relationships: Relationship[]
): Table[] => {
  // Build dependency graph
  const inDegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  tables.forEach(table => {
    inDegree.set(table.id, 0);
    outgoing.set(table.id, []);
  });

  relationships.forEach(rel => {
    inDegree.set(rel.toTableId, (inDegree.get(rel.toTableId) || 0) + 1);
    outgoing.get(rel.fromTableId)?.push(rel.toTableId);
  });

  // Topological sort to determine levels
  const levels: string[][] = [];
  const queue: string[] = [];
  const levelMap = new Map<string, number>();

  inDegree.forEach((degree, id) => {
    if (degree === 0) queue.push(id);
  });

  while (queue.length > 0) {
    const levelSize = queue.length;
    const currentLevel: string[] = [];

    for (let i = 0; i < levelSize; i++) {
      const id = queue.shift()!;
      currentLevel.push(id);
      levelMap.set(id, levels.length);

      outgoing.get(id)?.forEach(targetId => {
        const newDegree = (inDegree.get(targetId) || 0) - 1;
        inDegree.set(targetId, newDegree);
        if (newDegree === 0) queue.push(targetId);
      });
    }

    levels.push(currentLevel);
  }

  // Position tables by level
  const levelSpacing = 400;
  const tableSpacing = 350;

  return tables.map(table => {
    const level = levelMap.get(table.id) ?? 0;
    const levelTables = levels[level] || [];
    const indexInLevel = levelTables.indexOf(table.id);
    const totalInLevel = levelTables.length;

    return {
      ...table,
      x: 100 + indexInLevel * tableSpacing - (totalInLevel * tableSpacing) / 2 + 500,
      y: 100 + level * levelSpacing
    };
  });
};
