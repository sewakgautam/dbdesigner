// components/Canvas.tsx
'use client';

import React, { useRef, useEffect } from 'react';
import { Relationship, Table } from '@/types/database';

interface CanvasProps {
  tables: Table[];
  relationships: Relationship[];
  zoom: number;
  offset: { x: number; y: number };
  pendingLine?: {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  } | null;
  isDarkMode: boolean;
  onRelationshipClick?: (rel: Relationship, x: number, y: number) => void;
}

export const Canvas: React.FC<CanvasProps> = ({ 
  tables, 
  relationships, 
  zoom, 
  offset, 
  pendingLine, 
  isDarkMode,
  onRelationshipClick 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);

    // Draw existing relationships
    relationships.forEach(rel => {
      const fromTable = tables.find(t => t.id === rel.fromTableId);
      const toTable = tables.find(t => t.id === rel.toTableId);
      
      if (!fromTable || !toTable) return;

      const fromColumn = fromTable.columns.find(c => c.id === rel.fromColumnId);
      const toColumn = toTable.columns.find(c => c.id === rel.toColumnId);
      
      if (!fromColumn || !toColumn) return;

      const fromIndex = fromTable.columns.indexOf(fromColumn);
      const toIndex = toTable.columns.indexOf(toColumn);

      // Calculate start and end points
      const fromX = fromTable.x + 280;
      const fromY = fromTable.y + 50 + (fromIndex * 35) + 17;
      const toX = toTable.x;
      const toY = toTable.y + 50 + (toIndex * 35) + 17;

      // Draw orthogonal line (right-angle connections)
      ctx.beginPath();
      
      // Set line color based on relationship type
      if (rel.type === 'one-to-one') {
        ctx.strokeStyle = '#10b981';
      } else if (rel.type === 'one-to-many') {
        ctx.strokeStyle = '#3b82f6';
      } else {
        ctx.strokeStyle = '#8b5cf6';
      }
      ctx.lineWidth = 2;

      // Calculate control points for orthogonal routing
      const gap = 30; // Gap from table edges
      
      // Draw path: horizontal from start, then vertical, then horizontal to end
      ctx.moveTo(fromX, fromY);
      
      // If tables are far apart horizontally, use simple path
      if (Math.abs(toX - fromX) > 100) {
        ctx.lineTo(fromX + gap, fromY);
        ctx.lineTo(fromX + gap, toY);
        ctx.lineTo(toX, toY);
      } else {
        // If tables are close or overlapping, route around
        const routeX = fromX + gap;
        const routeY = fromY < toY ? Math.min(fromY, toY) - 40 : Math.max(fromY, toY) + 40;
        
        ctx.lineTo(routeX, fromY);
        ctx.lineTo(routeX, routeY);
        ctx.lineTo(toX - gap, routeY);
        ctx.lineTo(toX - gap, toY);
        ctx.lineTo(toX, toY);
      }
      
      ctx.stroke();

      // Draw arrow at the end
      const arrowSize = 8;
      ctx.beginPath();
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX + arrowSize, toY - arrowSize / 2);
      ctx.lineTo(toX + arrowSize, toY + arrowSize / 2);
      ctx.closePath();
      ctx.fillStyle = rel.type === 'one-to-one' ? '#10b981' : rel.type === 'one-to-many' ? '#3b82f6' : '#8b5cf6';
      ctx.fill();

      // Draw label in the middle
      const labelX = (fromX + toX) / 2;
      const labelY = (fromY + toY) / 2;

      ctx.fillStyle = isDarkMode ? '#1f2937' : '#ffffff';
      ctx.fillRect(labelX - 25, labelY - 12, 50, 24);
      
      // Draw border around label
      ctx.strokeStyle = rel.type === 'one-to-one' ? '#10b981' : rel.type === 'one-to-many' ? '#3b82f6' : '#8b5cf6';
      ctx.lineWidth = 1;
      ctx.strokeRect(labelX - 25, labelY - 12, 50, 24);
      
      ctx.fillStyle = rel.type === 'one-to-one' ? '#10b981' : rel.type === 'one-to-many' ? '#3b82f6' : '#8b5cf6';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      if (rel.type === 'one-to-one') {
        ctx.fillText('1:1', labelX, labelY);
      } else if (rel.type === 'one-to-many') {
        ctx.fillText('1:N', labelX, labelY);
      } else {
        ctx.fillText('N:M', labelX, labelY);
      }
    });

    // Draw pending relationship line
    if (pendingLine) {
      ctx.beginPath();
      ctx.moveTo(pendingLine.fromX, pendingLine.fromY);
      
      // Draw orthogonal preview line
      const gap = 30;
      ctx.lineTo(pendingLine.fromX + gap, pendingLine.fromY);
      ctx.lineTo(pendingLine.fromX + gap, pendingLine.toY);
      ctx.lineTo(pendingLine.toX, pendingLine.toY);
      
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw circle at end
      ctx.beginPath();
      ctx.arc(pendingLine.toX, pendingLine.toY, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#3b82f6';
      ctx.fill();
    }

    ctx.restore();
  }, [tables, relationships, zoom, offset, pendingLine, isDarkMode]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!onRelationshipClick) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x) / zoom;
    const y = (e.clientY - rect.top - offset.y) / zoom;

    // Check if click is near any relationship label
    relationships.forEach(rel => {
      const fromTable = tables.find(t => t.id === rel.fromTableId);
      const toTable = tables.find(t => t.id === rel.toTableId);
      
      if (!fromTable || !toTable) return;

      const fromColumn = fromTable.columns.find(c => c.id === rel.fromColumnId);
      const toColumn = toTable.columns.find(c => c.id === rel.toColumnId);
      
      if (!fromColumn || !toColumn) return;

      const fromIndex = fromTable.columns.indexOf(fromColumn);
      const toIndex = toTable.columns.indexOf(toColumn);

      const fromX = fromTable.x + 280;
      const fromY = fromTable.y + 50 + (fromIndex * 35) + 17;
      const toX = toTable.x;
      const toY = toTable.y + 50 + (toIndex * 35) + 17;

      const labelX = (fromX + toX) / 2;
      const labelY = (fromY + toY) / 2;

      // Check if click is within label bounds
      if (Math.abs(x - labelX) < 25 && Math.abs(y - labelY) < 12) {
        onRelationshipClick(rel, e.clientX, e.clientY);
      }
    });
  };

  return (
    <canvas
      ref={canvasRef}
      width={2000}
      height={2000}
      className="absolute inset-0 pointer-events-auto cursor-pointer"
      onClick={handleCanvasClick}
    />
  );
};
