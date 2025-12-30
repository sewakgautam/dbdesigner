// app/page.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Table, Relationship, Tool } from '@/types/database';

type ExportFormat = 'sql' | 'prisma' | 'typeorm' | 'sequelize' | 'django' | 'graphql' | 'png' | 'jpeg';
import { Canvas } from '@/components/canvas';
import { TableCard } from '@/components/TableCard';
import { CodeEditor } from '@/components/codeeditor';
import { useHistory } from '@/hooks/usehistory';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { autoLayout, gridLayout, hierarchicalLayout } from '@/utils/autoLayout';
import { exportToSQL, exportToTypeORM, exportToSequelize, exportToDjango, exportToGraphQL, exportToPrisma, downloadFile } from '@/utils/exportes';
import { importFromSQL, importFromPrisma } from '@/utils/importers';
import { 
  Plus, Download, ZoomIn, ZoomOut, Minimize2, Hand, Moon, Sun, Database, Trash2, 
  Image as ImageIcon, Undo2, Redo2, Layout, Upload, Copy, Scissors, FileText, Grid3x3
} from 'lucide-react';

const STORAGE_KEY = 'db_designer_state';

type DiagramState = {
  tables: Table[];
  relationships: Relationship[];
  diagramName: string;
};

export default function Home() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [diagramName, setDiagramName] = useState('Untitled Diagram');
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingTable, setDraggingTable] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [pendingRelationship, setPendingRelationship] = useState<{
    tableId: string;
    columnId: string;
    x: number;
    y: number;
  } | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [editingRelationship, setEditingRelationship] = useState<{
    rel: Relationship;
    x: number;
    y: number;
  } | null>(null);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [copiedTables, setCopiedTables] = useState<Table[]>([]);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize history with default state
  const { state, setState, undo, redo, canUndo, canRedo } = useHistory({
    tables: [],
    relationships: [],
    diagramName: 'Untitled Diagram'
  });

  const tables = state.tables;
  const relationships = state.relationships;

  const setTables = (newTables: Table[]) => {
    setState({ ...state, tables: newTables });
  };

  const setRelationships = (newRels: Relationship[]) => {
    setState({ ...state, relationships: newRels });
  };

  // Load from storage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setState({
          tables: data.tables || [],
          relationships: data.relationships || [],
          diagramName: data.diagramName || 'Untitled Diagram'
        });
        setDiagramName(data.diagramName || 'Untitled Diagram');
      } catch (e) {
        console.error('Failed to load saved state:', e);
      }
    } else {
      // Default tables
      setState({
        tables: [
          {
            id: 'table_1',
            name: 'User',
            x: 100,
            y: 100,
            columns: [
              {
                id: 'col_1', name: 'id', type: 'Int', isPrimaryKey: true, isForeignKey: false, isNullable: false,
                isUnique: undefined
              },
              {
                id: 'col_2', name: 'email', type: 'String', isPrimaryKey: false, isForeignKey: false, isNullable: false,
                isUnique: undefined
              },
              {
                id: 'col_3', name: 'name', type: 'String', isPrimaryKey: false, isForeignKey: false, isNullable: true,
                isUnique: undefined
              },
              {
                id: 'col_4', name: 'createdAt', type: 'DateTime', isPrimaryKey: false, isForeignKey: false, isNullable: false,
                isUnique: undefined
              }
            ]
          },
          {
            id: 'table_2',
            name: 'Post',
            x: 500,
            y: 100,
            columns: [
              {
                id: 'col_5', name: 'id', type: 'Int', isPrimaryKey: true, isForeignKey: false, isNullable: false,
                isUnique: undefined
              },
              {
                id: 'col_6', name: 'title', type: 'String', isPrimaryKey: false, isForeignKey: false, isNullable: false,
                isUnique: undefined
              },
              {
                id: 'col_7', name: 'content', type: 'String', isPrimaryKey: false, isForeignKey: false, isNullable: true,
                isUnique: undefined
              },
              {
                id: 'col_8', name: 'authorId', type: 'Int', isPrimaryKey: false, isForeignKey: true, isNullable: false,
                isUnique: undefined
              }
            ]
          }
        ],
        relationships: [],
        diagramName: 'Untitled Diagram'
      });
    }
  }, []);


  // Save to storage whenever state changes
  useEffect(() => {
    const stateToSave = { ...state, diagramName };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  }, [state, diagramName]);

  // Update FK markers when relationships change
  useEffect(() => {
    const updatedTables = tables.map(table => {
      const updatedColumns = table.columns.map(col => {
        const isForeignKey = relationships.some(
          rel => rel.fromTableId === table.id && rel.fromColumnId === col.id
        );
        return { ...col, isForeignKey };
      });
      return { ...table, columns: updatedColumns };
    });
    
    if (JSON.stringify(updatedTables) !== JSON.stringify(tables)) {
      setTables(updatedTables);
    }
  }, [relationships]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onUndo: () => canUndo && undo(),
    onRedo: () => canRedo && redo(),
    onSave: () => handleExport('sql'),
    onDelete: () => handleDeleteSelected(),
    onSelectAll: () => setSelectedTables(new Set(tables.map(t => t.id))),
    onCopy: () => handleCopy(),
    onPaste: () => handlePaste(),
    onZoomIn: () => setZoom(Math.min(2, zoom + 0.1)),
    onZoomOut: () => setZoom(Math.max(0.5, zoom - 0.1)),
    onResetZoom: () => resetZoom(),
    onNewTable: () => addTable()
  });

  const addTable = () => {
    const newTable: Table = {
      id: `table_${Date.now()}`,
      name: `Table${tables.length + 1}`,
      x: 100 + tables.length * 50,
      y: 100 + tables.length * 50,
      columns: [
        {
          id: `col_${Date.now()}`, name: 'id', type: 'Int', isPrimaryKey: true, isForeignKey: false, isNullable: false,
          isUnique: undefined
        }
      ]
    };
    setTables([...tables, newTable]);
  };

  const updateTable = (updatedTable: Table) => {
    setTables(tables.map(t => t.id === updatedTable.id ? updatedTable : t));
  };

  const deleteTable = (id: string) => {
    setTables(tables.filter(t => t.id !== id));
    setRelationships(relationships.filter(r => r.fromTableId !== id && r.toTableId !== id));
    setSelectedTables(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const handleDeleteSelected = () => {
    if (selectedTables.size > 0) {
      const remainingTables = tables.filter(t => !selectedTables.has(t.id));
      const remainingRels = relationships.filter(
        r => !selectedTables.has(r.fromTableId) && !selectedTables.has(r.toTableId)
      );
      setTables(remainingTables);
      setRelationships(remainingRels);
      setSelectedTables(new Set());
    }
  };

  const handleCopy = () => {
    if (selectedTables.size > 0) {
      const tablesToCopy = tables.filter(t => selectedTables.has(t.id));
      setCopiedTables(tablesToCopy);
    }
  };

  const handlePaste = () => {
    if (copiedTables.length > 0) {
      const newTables = copiedTables.map(table => ({
        ...table,
        id: `table_${Date.now()}_${Math.random()}`,
        name: `${table.name}_copy`,
        x: table.x + 50,
        y: table.y + 50,
        columns: table.columns.map(col => ({
          ...col,
          id: `col_${Date.now()}_${Math.random()}`,
          isForeignKey: false
        }))
      }));
      setTables([...tables, ...newTables]);
      setSelectedTables(new Set(newTables.map(t => t.id)));
    }
  };

  const snapPosition = (pos: number): number => {
    if (!snapToGrid) return pos;
    const gridSize = 50;
    return Math.round(pos / gridSize) * gridSize;
  };

  const handleDragStart = (e: React.MouseEvent, tableId: string) => {
    if (activeTool !== 'select') return;
    e.stopPropagation();
    setDraggingTable(tableId);
    setDragStart({ x: e.clientX, y: e.clientY });
    
    if (!selectedTables.has(tableId)) {
      setSelectedTables(new Set([tableId]));
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const x = (e.clientX - rect.left - offset.x) / zoom;
      const y = (e.clientY - rect.top - offset.y) / zoom;
      setMousePos({ x, y });
    }

    if (draggingTable && activeTool === 'select') {
      const dx = (e.clientX - dragStart.x) / zoom;
      const dy = (e.clientY - dragStart.y) / zoom;
      
      setTables(tables.map(t => {
        if (selectedTables.has(t.id)) {
          return {
            ...t,
            x: snapPosition(t.x + dx),
            y: snapPosition(t.y + dy)
          };
        }
        return t;
      }));
      
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if ((isPanning || activeTool === 'hand') && !draggingTable) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setOffset({ x: offset.x + dx, y: offset.y + dy });
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setDraggingTable(null);
    setIsPanning(false);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || activeTool === 'hand' || e.target === canvasRef.current) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    } else if (e.target === canvasRef.current && activeTool === 'select') {
      setSelectedTables(new Set());
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const delta = -e.deltaY / 500;
      setZoom(Math.max(0.5, Math.min(2, zoom + delta)));
    } else {
      setOffset({ x: offset.x - e.deltaX, y: offset.y - e.deltaY });
    }
  };

  const addRelationship = (tableId: string, columnId: string, x: number, y: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const canvasX = (x - rect.left - offset.x) / zoom;
    const canvasY = (y - rect.top - offset.y) / zoom;
    
    if (!pendingRelationship) {
      setPendingRelationship({ tableId, columnId, x: canvasX, y: canvasY });
    } else {
      const relType = activeTool === 'one-to-one' || activeTool === 'one-to-many' || activeTool === 'many-to-many' ? activeTool : 'one-to-many';
      const newRel: Relationship = {
        id: `rel_${Date.now()}`,
        fromTableId: pendingRelationship.tableId,
        fromColumnId: pendingRelationship.columnId,
        toTableId: tableId,
        toColumnId: columnId,
        type: relType,
        onUpdate: undefined,
        onDelete: undefined
      };
      setRelationships([...relationships, newRel]);
      setPendingRelationship(null);
      if (activeTool !== 'select') setActiveTool('select');
    }
  };

  const handleRelationshipClick = (rel: Relationship, x: number, y: number) => {
    setEditingRelationship({ rel, x, y });
  };

  const updateRelationshipType = (relId: string, newType: 'one-to-one' | 'one-to-many' | 'many-to-many') => {
    setRelationships(relationships.map(r => r.id === relId ? { ...r, type: newType } : r));
    setEditingRelationship(null);
  };

  const deleteRelationship = (relId: string) => {
    setRelationships(relationships.filter(r => r.id !== relId));
    setEditingRelationship(null);
  };

  const handleExport = (format: ExportFormat) => {
    let content = '';
    let filename = diagramName.replace(/\s+/g, '_');
    
    switch (format) {
      case 'sql':
        content = exportToSQL(tables, relationships, diagramName);
        downloadFile(content, `${filename}.sql`);
        break;
      case 'prisma':
        content = exportToPrisma(tables, relationships);
        downloadFile(content, `${filename}.prisma`);
        break;
      case 'typeorm':
        content = exportToTypeORM(tables, relationships);
        downloadFile(content, `${filename}.typeorm.ts`);
        break;
      case 'sequelize':
        content = exportToSequelize(tables, relationships);
        downloadFile(content, `${filename}.sequelize.js`);
        break;
      case 'django':
        content = exportToDjango(tables, relationships);
        downloadFile(content, `${filename}.models.py`);
        break;
      case 'graphql':
        content = exportToGraphQL(tables, relationships);
        downloadFile(content, `${filename}.graphql`);
        break;
      case 'png':
      case 'jpeg':
        exportAsImage(format);
        break;
    }
    setShowExportMenu(false);
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        let imported;
        if (file.name.endsWith('.sql')) {
          imported = importFromSQL(content);
        } else if (file.name.endsWith('.prisma')) {
          imported = importFromPrisma(content);
        } else {
          alert('Unsupported file format');
          return;
        }
        
        setTables(imported.tables);
        setRelationships(imported.relationships);
        setShowImportModal(false);
      } catch (err) {
        alert('Error importing file: ' + (err instanceof Error ? err.message : String(err)));
      }
    };
    reader.readAsText(file);
  };

  const handleAutoLayout = (type: 'force' | 'grid' | 'hierarchical') => {
    let layoutedTables;
    switch (type) {
      case 'force':
        layoutedTables = autoLayout(tables, relationships);
        break;
      case 'grid':
        layoutedTables = gridLayout(tables);
        break;
      case 'hierarchical':
        layoutedTables = hierarchicalLayout(tables, relationships);
        break;
    }
    setTables(layoutedTables);
    setShowLayoutMenu(false);
  };

  const exportAsImage = (format: 'png' | 'jpeg') => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx || tables.length === 0) {
      alert('No tables to export!');
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    tables.forEach(table => {
      minX = Math.min(minX, table.x);
      minY = Math.min(minY, table.y);
      maxX = Math.max(maxX, table.x + 280);
      maxY = Math.max(maxY, table.y + 50 + table.columns.length * 35 + 50);
    });

    const padding = 50;
    minX -= padding; minY -= padding; maxX += padding; maxY += padding;
    canvas.width = maxX - minX;
    canvas.height = maxY - minY;

    ctx.fillStyle = isDarkMode ? '#030712' : '#f9fafb';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw relationships
    relationships.forEach(rel => {
      const fromTable = tables.find(t => t.id === rel.fromTableId);
      const toTable = tables.find(t => t.id === rel.toTableId);
      if (!fromTable || !toTable) return;
      const fromColumn = fromTable.columns.find(c => c.id === rel.fromColumnId);
      const toColumn = toTable.columns.find(c => c.id === rel.toColumnId);
      if (!fromColumn || !toColumn) return;

      const fromIndex = fromTable.columns.indexOf(fromColumn);
      const toIndex = toTable.columns.indexOf(toColumn);
      const fromX = (fromTable.x + 280) - minX;
      const fromY = (fromTable.y + 50 + fromIndex * 35 + 17) - minY;
      const toX = toTable.x - minX;
      const toY = (toTable.y + 50 + toIndex * 35 + 17) - minY;

      ctx.beginPath();
      ctx.strokeStyle = rel.type === 'one-to-one' ? '#10b981' : rel.type === 'one-to-many' ? '#3b82f6' : '#8b5cf6';
      ctx.lineWidth = 2;
      const gap = 30;
      ctx.moveTo(fromX, fromY);
      if (Math.abs(toX - fromX) > 100) {
        ctx.lineTo(fromX + gap, fromY);
        ctx.lineTo(fromX + gap, toY);
        ctx.lineTo(toX, toY);
      } else {
        const routeX = fromX + gap;
        const routeY = fromY < toY ? Math.min(fromY, toY) - 40 : Math.max(fromY, toY) + 40;
        ctx.lineTo(routeX, fromY);
        ctx.lineTo(routeX, routeY);
        ctx.lineTo(toX - gap, routeY);
        ctx.lineTo(toX - gap, toY);
        ctx.lineTo(toX, toY);
      }
      ctx.stroke();

      const arrowSize = 8;
      ctx.beginPath();
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX + arrowSize, toY - arrowSize / 2);
      ctx.lineTo(toX + arrowSize, toY + arrowSize / 2);
      ctx.closePath();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();

      const labelX = (fromX + toX) / 2, labelY = (fromY + toY) / 2;
      ctx.fillStyle = isDarkMode ? '#1f2937' : '#ffffff';
      ctx.fillRect(labelX - 25, labelY - 12, 50, 24);
      ctx.strokeStyle = rel.type === 'one-to-one' ? '#10b981' : rel.type === 'one-to-many' ? '#3b82f6' : '#8b5cf6';
      ctx.lineWidth = 1;
      ctx.strokeRect(labelX - 25, labelY - 12, 50, 24);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(rel.type === 'one-to-one' ? '1:1' : rel.type === 'one-to-many' ? '1:N' : 'N:M', labelX, labelY);
    });

    // Draw tables
    tables.forEach((table: { x: number; y: number; columns: { isPrimaryKey: any; isForeignKey: any; name: string; type: string; }[]; name: string; }) => {
      const x = table.x - minX, y = table.y - minY;
      ctx.fillStyle = isDarkMode ? '#1f2937' : '#ffffff';
      ctx.strokeStyle = isDarkMode ? '#374151' : '#d1d5db';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, 280, 50 + table.columns.length * 35 + 50, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isDarkMode ? '#374151' : '#1f2937';
      ctx.beginPath();
      ctx.roundRect(x, y, 280, 42, [8, 8, 0, 0]);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(table.name, x + 40, y + 21);

      table.columns.forEach((col: { isPrimaryKey: any; isForeignKey: any; name: string; type: string; }, idx: number) => {
        const colY = y + 50 + idx * 35;
        ctx.fillStyle = isDarkMode ? '#1f2937' : '#ffffff';
        ctx.fillRect(x + 8, colY, 264, 35);

        if (col.isPrimaryKey) {
          ctx.font = 'bold 12px sans-serif';
          ctx.fillText('🔑', x + 12, colY + 17);
        }
        if (col.isForeignKey && !col.isPrimaryKey) {
          ctx.font = 'bold 12px sans-serif';
          ctx.fillText('🔗', x + 12, colY + 17);
        }

        ctx.fillStyle = isDarkMode ? '#ffffff' : '#111827';
        ctx.font = '13px sans-serif';
        ctx.fillText(col.name, x + 35, colY + 17);

        ctx.fillStyle = isDarkMode ? '#9ca3af' : '#6b7280';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(col.type, x + 260, colY + 17);
        ctx.textAlign = 'left';
      });
    });

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${diagramName.replace(/\s+/g, '_')}_diagram.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    }, format === 'png' ? 'image/png' : 'image/jpeg', format === 'jpeg' ? 0.95 : undefined);
  };

  const resetZoom = () => { setZoom(1); setOffset({ x: 0, y: 0 }); };
  
  const clearAll = () => {
    if (confirm('Are you sure you want to clear all tables and relationships?')) {
      setState({ tables: [], relationships: [], diagramName: 'Untitled Diagram' });
      setDiagramName('Untitled Diagram');
    }
  };

  const pendingLine = pendingRelationship ? {
    fromX: pendingRelationship.x, fromY: pendingRelationship.y,
    toX: mousePos.x, toY: mousePos.y
  } : null;

  return (
    <div className={`h-screen flex ${isDarkMode ? 'bg-gray-950' : 'bg-gray-50'}`}>
      <div className={`w-96 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
        <CodeEditor 
          tables={tables} 
          relationships={relationships}
          onApplyCode={(newTables, newRels) => {
            setState({ ...state, tables: newTables, relationships: newRels });
          }}
          isDarkMode={isDarkMode} 
        />
      </div>

      <div className="flex-1 flex flex-col">
        <header className={`border-b ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Database className={isDarkMode ? 'text-blue-400' : 'text-blue-600'} size={28} />
                <h1 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>DB Designer</h1>
              </div>
              <div className="h-8 w-px bg-gray-300"></div>
              <input type="text" value={diagramName} onChange={(e) => setDiagramName(e.target.value)}
                className={`text-base font-medium px-3 py-1.5 rounded-md border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`}
                placeholder="Untitled Diagram" />
            </div>

            <div className="flex items-center gap-3">
              {/* Undo/Redo */}
              <div className="flex items-center gap-1">
                <button onClick={undo} disabled={!canUndo}
                  className={`p-2 rounded-md transition-colors ${
                    canUndo 
                      ? isDarkMode ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-white text-gray-700 hover:bg-gray-100'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`} title="Undo (Ctrl+Z)">
                  <Undo2 size={18} />
                </button>
                <button onClick={redo} disabled={!canRedo}
                  className={`p-2 rounded-md transition-colors ${
                    canRedo 
                      ? isDarkMode ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-white text-gray-700 hover:bg-gray-100'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`} title="Redo (Ctrl+Y)">
                  <Redo2 size={18} />
                </button>
              </div>

              <div className="h-6 w-px bg-gray-300"></div>

              <button onClick={addTable}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium transition-colors">
                <Plus size={18} /><span>New Table</span>
              </button>

              {/* Layout Menu */}
              <div className="relative">
                <button onClick={() => setShowLayoutMenu(!showLayoutMenu)}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 font-medium transition-colors">
                  <Layout size={18} /><span>Auto Layout</span>
                </button>
                {showLayoutMenu && (
                  <div className={`absolute right-0 mt-2 w-48 rounded-md shadow-lg ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'} z-50`}>
                    <div className="py-1">
                      <button onClick={() => handleAutoLayout('force')}
                        className={`w-full text-left px-4 py-2 text-sm ${isDarkMode ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                        Force-Directed
                      </button>
                      <button onClick={() => handleAutoLayout('grid')}
                        className={`w-full text-left px-4 py-2 text-sm ${isDarkMode ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                        Grid Layout
                      </button>
                      <button onClick={() => handleAutoLayout('hierarchical')}
                        className={`w-full text-left px-4 py-2 text-sm ${isDarkMode ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                        Hierarchical
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Export Menu */}
              <div className="relative">
                <button onClick={() => setShowExportMenu(!showExportMenu)}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-medium transition-colors">
                  <Download size={18} /><span>Export</span>
                </button>
                {showExportMenu && (
                  <div className={`absolute right-0 mt-2 w-48 rounded-md shadow-lg ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'} z-50`}>
                    <div className="py-1">
                      <button onClick={() => handleExport('sql')}
                        className={`w-full text-left px-4 py-2 text-sm ${isDarkMode ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                        SQL
                      </button>
                      <button onClick={() => handleExport('prisma')}
                        className={`w-full text-left px-4 py-2 text-sm ${isDarkMode ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                        Prisma Schema
                      </button>
                      <button onClick={() => handleExport('typeorm')}
                        className={`w-full text-left px-4 py-2 text-sm ${isDarkMode ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                        TypeORM
                      </button>
                      <button onClick={() => handleExport('sequelize')}
                        className={`w-full text-left px-4 py-2 text-sm ${isDarkMode ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                        Sequelize
                      </button>
                      <button onClick={() => handleExport('django')}
                        className={`w-full text-left px-4 py-2 text-sm ${isDarkMode ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                        Django Models
                      </button>
                      <button onClick={() => handleExport('graphql')}
                        className={`w-full text-left px-4 py-2 text-sm ${isDarkMode ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                        GraphQL Schema
                      </button>
                      <div className={`border-t my-1 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}></div>
                      <button onClick={() => handleExport('png')}
                        className={`w-full text-left px-4 py-2 text-sm ${isDarkMode ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                        Export as PNG
                      </button>
                      <button onClick={() => handleExport('jpeg')}
                        className={`w-full text-left px-4 py-2 text-sm ${isDarkMode ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                        Export as JPEG
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Import */}
              <button onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 font-medium transition-colors">
                <Upload size={18} /><span>Import</span>
              </button>
              <input ref={fileInputRef} type="file" accept=".sql,.prisma" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])} />

              <button onClick={clearAll}
                className="flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors bg-red-600 text-white hover:bg-red-700">
                <Trash2 size={18} /><span>Clear</span>
              </button>
              
              <button onClick={() => setIsDarkMode(!isDarkMode)}
                className={`p-2 rounded-md transition-colors ${isDarkMode ? 'bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-700' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'}`}
                title="Toggle Theme">
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>
          </div>

          {/* Toolbar */}
          <div className={`px-6 py-3 border-t flex items-center justify-between ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center gap-2">
              <div className={`flex items-center rounded-md overflow-hidden border ${isDarkMode ? 'border-gray-700' : 'border-gray-300'}`}>
                <button onClick={() => setActiveTool('select')}
                  className={`px-3 py-2 transition-colors ${activeTool === 'select' ? 'bg-blue-600 text-white' : isDarkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                  title="Select (V)">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3l7 7m0 0l4-4m-4 4v10m0 0l-3-3m3 3l3-3"/>
                  </svg>
                </button>
                <button onClick={() => setActiveTool(activeTool === 'hand' ? 'select' : 'hand')}
                  className={`px-3 py-2 border-l transition-colors ${isDarkMode ? 'border-gray-700' : 'border-gray-300'} ${activeTool === 'hand' ? 'bg-blue-600 text-white' : isDarkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                  title="Pan (H)">
                  <Hand size={18} />
                </button>
              </div>

              <div className="w-px h-6 bg-gray-300 mx-2"></div>

              <div className={`flex items-center gap-1 px-2 py-1 rounded-md ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-300'}`}>
                <span className={`text-xs font-medium px-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Relationships:</span>
                <button onClick={() => setActiveTool('one-to-one')}
                  className={`px-2 py-1 rounded transition-colors ${activeTool === 'one-to-one' ? 'bg-green-600 text-white' : isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}
                  title="One to One (1)">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="6" cy="12" r="3"/><circle cx="18" cy="12" r="3"/><path d="M9 12h6"/>
                  </svg>
                </button>
                <button onClick={() => setActiveTool('one-to-many')}
                  className={`px-2 py-1 rounded transition-colors ${activeTool === 'one-to-many' ? 'bg-blue-600 text-white' : isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}
                  title="One to Many (2)">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="6" cy="12" r="3"/><path d="M9 12h6M15 12l-2-2m2 2l-2 2M18 9l3 3-3 3"/>
                  </svg>
                </button>
                <button onClick={() => setActiveTool('many-to-many')}
                  className={`px-2 py-1 rounded transition-colors ${activeTool === 'many-to-many' ? 'bg-purple-600 text-white' : isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}
                  title="Many to Many (3)">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l3 3-3 3M18 9l-3 3 3 3M9 12h6"/>
                  </svg>
                </button>
              </div>

              <div className="w-px h-6 bg-gray-300 mx-2"></div>

              {/* Grid Options */}
              <button onClick={() => setShowGrid(!showGrid)}
                className={`px-2 py-1 rounded text-sm ${showGrid ? 'bg-blue-600 text-white' : isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}
                title="Toggle Grid">
                <Grid3x3 size={18} />
              </button>
              <button onClick={() => setSnapToGrid(!snapToGrid)}
                className={`px-3 py-1 rounded text-xs font-medium ${snapToGrid ? 'bg-blue-600 text-white' : isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}
                title="Snap to Grid">
                SNAP
              </button>
            </div>

            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-300'}`}>
              <button onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                className={`p-1 rounded hover:bg-gray-700 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <ZoomOut size={16} />
              </button>
              <span className={`text-sm font-medium min-w-[50px] text-center ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {Math.round(zoom * 100)}%
              </span>
              <button onClick={() => setZoom(Math.min(2, zoom + 0.1))}
                className={`p-1 rounded hover:bg-gray-700 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <ZoomIn size={16} />
              </button>
              <div className="w-px h-4 bg-gray-600 mx-1"></div>
              <button onClick={resetZoom}
                className={`p-1 rounded hover:bg-gray-700 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
                title="Reset View (Ctrl+0)">
                <Minimize2 size={16} />
              </button>
            </div>

            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {tables.length} {tables.length === 1 ? 'table' : 'tables'} · {relationships.length} {relationships.length === 1 ? 'relationship' : 'relationships'}
              {selectedTables.size > 0 && ` · ${selectedTables.size} selected`}
            </div>
          </div>
        </header>

        <div className="flex-1 relative">
          <div ref={canvasRef}
            className={`h-full relative overflow-hidden ${
              activeTool === 'hand' ? 'cursor-grab active:cursor-grabbing' : 
              pendingRelationship ? 'cursor-crosshair' : 'cursor-default'
            } ${isDarkMode ? 'bg-gray-950' : 'bg-gray-50'}`}
            style={{
              backgroundImage: showGrid ? isDarkMode 
                ? 'radial-gradient(circle, #374151 1px, transparent 1px)'
                : 'radial-gradient(circle, #d1d5db 1px, transparent 1px)'
              : 'none',
              backgroundSize: showGrid ? `${50 * zoom}px ${50 * zoom}px` : 'auto',
              backgroundPosition: showGrid ? `${offset.x}px ${offset.y}px` : '0 0'
            }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}>
            <Canvas tables={tables} relationships={relationships} zoom={zoom} offset={offset}
              pendingLine={pendingLine} isDarkMode={isDarkMode}
              onRelationshipClick={handleRelationshipClick} />
            
            <div style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
              {tables.map(table => (
                <TableCard key={table.id} table={table} onUpdateTable={updateTable}
                  onDeleteTable={deleteTable} onAddRelationship={addRelationship}
                  isDragging={draggingTable === table.id} onDragStart={handleDragStart}
                  isDarkMode={isDarkMode} 
                  isSelected={selectedTables.has(table.id)}
                  onSelect={(id) => {
                    const newSelected = new Set(selectedTables);
                    if (newSelected.has(id)) newSelected.delete(id);
                    else newSelected.add(id);
                    setSelectedTables(newSelected);
                  }} />
              ))}
            </div>

            {pendingRelationship && (
              <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm font-medium">
                Click a column to complete the relationship
              </div>
            )}

            {editingRelationship && (
              <div className={`absolute z-50 rounded-lg shadow-xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}
                style={{ left: editingRelationship.x, top: editingRelationship.y, transform: 'translate(-50%, -100%) translateY(-10px)' }}>
                <div className="p-2">
                  <button onClick={() => updateRelationshipType(editingRelationship.rel.id, 'one-to-one')}
                    className={`w-full text-left px-3 py-2 rounded text-sm ${
                      editingRelationship.rel.type === 'one-to-one' ? 'bg-green-600 text-white' :
                      isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                    }`}>
                    One to One (1:1)
                  </button>
                  <button onClick={() => updateRelationshipType(editingRelationship.rel.id, 'one-to-many')}
                    className={`w-full text-left px-3 py-2 rounded text-sm ${
                      editingRelationship.rel.type === 'one-to-many' ? 'bg-blue-600 text-white' :
                      isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                    }`}>
                    One to Many (1:N)
                  </button>
                  <button onClick={() => updateRelationshipType(editingRelationship.rel.id, 'many-to-many')}
                    className={`w-full text-left px-3 py-2 rounded text-sm ${
                      editingRelationship.rel.type === 'many-to-many' ? 'bg-purple-600 text-white' :
                      isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                    }`}>
                    Many to Many (N:M)
                  </button>
                  <div className={`border-t my-1 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}></div>
                  <button onClick={() => deleteRelationship(editingRelationship.rel.id)}
                    className="w-full text-left px-3 py-2 rounded text-sm text-red-600 hover:bg-red-50">
                    Delete Relationship
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
