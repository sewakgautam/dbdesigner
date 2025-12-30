// app/page.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Table, Relationship, Tool } from '@/types/database';
import { Canvas } from '@/components/canvas';
import { TableCard } from '@/components/TableCard';
import { CodeEditor } from '@/components/codeeditor';
import { Plus, Download, ZoomIn, ZoomOut, Minimize2, Hand, Moon, Sun, Database, Trash2, Image as ImageIcon, Upload } from 'lucide-react';

const STORAGE_KEY = 'db_designer_state';

export default function Home() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [diagramName, setDiagramName] = useState('Untitled Diagram');
  const [tables, setTables] = useState<Table[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
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
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [editingRelationship, setEditingRelationship] = useState<{
    rel: Relationship;
    x: number;
    y: number;
  } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load from storage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setTables(data.tables || []);
        setRelationships(data.relationships || []);
        setDiagramName(data.diagramName || 'Untitled Diagram');
      } catch (e) {
        console.error('Failed to load saved state:', e);
      }
    } else {
      // Default tables if nothing saved
      setTables([
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
          ],
          name: ''
        }
      ]);
    }
  }, []);

  // Save to storage whenever state changes
  useEffect(() => {
    const state = {
      tables,
      relationships,
      diagramName
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [tables, relationships, diagramName]);

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

  const addTable = () => {
    const newTable: Table = {
      id: `table_${Date.now()}`,
      name: `Table${tables.length + 1}`,
      x: 100 + tables.length * 50,
      y: 100 + tables.length * 50,
      columns: [
        {
          id: `col_${Date.now()}`,
          name: 'id',
          type: 'Int',
          isPrimaryKey: true,
          isForeignKey: false,
          isNullable: false,
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
  };

  const handleDragStart = (e: React.MouseEvent, tableId: string) => {
    if (activeTool !== 'select') return;
    e.stopPropagation();
    setDraggingTable(tableId);
    setDragStart({ x: e.clientX, y: e.clientY });
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
      
      setTables(tables.map(t =>
        t.id === draggingTable
          ? { ...t, x: t.x + dx, y: t.y + dy }
          : t
      ));
      
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
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    
    if (e.ctrlKey || e.metaKey) {
      const delta = -e.deltaY / 500;
      const newZoom = Math.max(0.5, Math.min(2, zoom + delta));
      setZoom(newZoom);
    } else {
      setOffset({
        x: offset.x - e.deltaX,
        y: offset.y - e.deltaY
      });
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
      const relType = activeTool === 'one-to-one' || activeTool === 'one-to-many' || activeTool === 'many-to-many' 
        ? activeTool 
        : 'one-to-many';
      
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
      if (activeTool !== 'select') {
        setActiveTool('select');
      }
    }
  };

  const handleRelationshipClick = (rel: Relationship, x: number, y: number) => {
    setEditingRelationship({ rel, x, y });
  };

  const updateRelationshipType = (relId: string, newType: 'one-to-one' | 'one-to-many' | 'many-to-many') => {
    setRelationships(relationships.map(r => 
      r.id === relId ? { ...r, type: newType } : r
    ));
    setEditingRelationship(null);
  };

  const deleteRelationship = (relId: string) => {
    setRelationships(relationships.filter(r => r.id !== relId));
    setEditingRelationship(null);
  };

  const exportSQL = () => {
    let sql = `-- Database Schema: ${diagramName}\n`;
    sql += `-- Generated: ${new Date().toISOString()}\n\n`;
    
    tables.forEach(table => {
      sql += `CREATE TABLE ${table.name} (\n`;
      sql += table.columns.map(col => {
        let line = `  ${col.name} ${col.type === 'Int' ? 'INTEGER' : col.type === 'String' ? 'VARCHAR(255)' : col.type === 'DateTime' ? 'TIMESTAMP' : col.type === 'Boolean' ? 'BOOLEAN' : col.type}`;
        if (col.isPrimaryKey) line += ' PRIMARY KEY';
        if (!col.isNullable) line += ' NOT NULL';
        if (col.defaultValue) line += ` DEFAULT ${col.defaultValue}`;
        return line;
      }).join(',\n');
      sql += '\n);\n\n';
    });

    relationships.forEach(rel => {
      const fromTable = tables.find(t => t.id === rel.fromTableId);
      const toTable = tables.find(t => t.id === rel.toTableId);
      const fromCol = fromTable?.columns.find(c => c.id === rel.fromColumnId);
      const toCol = toTable?.columns.find(c => c.id === rel.toColumnId);
      
      if (fromTable && toTable && fromCol && toCol) {
        sql += `ALTER TABLE ${fromTable.name}\n`;
        sql += `  ADD FOREIGN KEY (${fromCol.name})\n`;
        sql += `  REFERENCES ${toTable.name}(${toCol.name});\n\n`;
      }
    });

    const blob = new Blob([sql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${diagramName.replace(/\s+/g, '_')}_schema.sql`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAsImage = (format: 'png' | 'jpeg') => {
    if (tables.length === 0) {
      alert('No tables to export!');
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate bounds ONLY of the content area with tables
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    tables.forEach(table => {
      minX = Math.min(minX, table.x);
      minY = Math.min(minY, table.y);
      maxX = Math.max(maxX, table.x + 280);
      maxY = Math.max(maxY, table.y + 50 + table.columns.length * 35 + 50);
    });

    // Add padding
    const padding = 50;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const width = maxX - minX;
    const height = maxY - minY;

    canvas.width = width;
    canvas.height = height;

    // Fill background
    ctx.fillStyle = isDarkMode ? '#030712' : '#f9fafb';
    ctx.fillRect(0, 0, width, height);

    // Draw relationships first (behind tables)
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

      // Draw orthogonal line
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

      // Draw arrow
      const arrowSize = 8;
      ctx.beginPath();
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX + arrowSize, toY - arrowSize / 2);
      ctx.lineTo(toX + arrowSize, toY + arrowSize / 2);
      ctx.closePath();
      ctx.fillStyle = rel.type === 'one-to-one' ? '#10b981' : rel.type === 'one-to-many' ? '#3b82f6' : '#8b5cf6';
      ctx.fill();

      // Draw label
      const labelX = (fromX + toX) / 2;
      const labelY = (fromY + toY) / 2;

      ctx.fillStyle = isDarkMode ? '#1f2937' : '#ffffff';
      ctx.fillRect(labelX - 25, labelY - 12, 50, 24);
      
      ctx.strokeStyle = rel.type === 'one-to-one' ? '#10b981' : rel.type === 'one-to-many' ? '#3b82f6' : '#8b5cf6';
      ctx.lineWidth = 1;
      ctx.strokeRect(labelX - 25, labelY - 12, 50, 24);
      
      ctx.fillStyle = rel.type === 'one-to-one' ? '#10b981' : rel.type === 'one-to-many' ? '#3b82f6' : '#8b5cf6';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const labelText = rel.type === 'one-to-one' ? '1:1' : rel.type === 'one-to-many' ? '1:N' : 'N:M';
      ctx.fillText(labelText, labelX, labelY);
    });

    // Draw tables
    tables.forEach(table => {
      const x = table.x - minX;
      const y = table.y - minY;

      // Draw table card
      ctx.fillStyle = isDarkMode ? '#1f2937' : '#ffffff';
      ctx.strokeStyle = isDarkMode ? '#374151' : '#d1d5db';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, 280, 50 + table.columns.length * 35 + 50, 8);
      ctx.fill();
      ctx.stroke();

      // Draw header
      ctx.fillStyle = isDarkMode ? '#374151' : '#1f2937';
      ctx.beginPath();
      ctx.roundRect(x, y, 280, 42, [8, 8, 0, 0]);
      ctx.fill();

      // Draw table name
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(table.name, x + 40, y + 21);

      // Draw columns
      table.columns.forEach((col, idx) => {
        const colY = y + 50 + idx * 35;
        
        // Column background
        ctx.fillStyle = isDarkMode ? '#1f2937' : '#ffffff';
        ctx.fillRect(x + 8, colY, 264, 35);

        // Draw PK icon
        if (col.isPrimaryKey) {
          ctx.font = 'bold 12px sans-serif';
          ctx.fillText('🔑', x + 12, colY + 17);
        }

        // Draw FK icon
        if (col.isForeignKey && !col.isPrimaryKey) {
          ctx.font = 'bold 12px sans-serif';
          ctx.fillText('🔗', x + 12, colY + 17);
        }

        // Draw column name
        ctx.fillStyle = isDarkMode ? '#ffffff' : '#111827';
        ctx.font = '13px sans-serif';
        ctx.fillText(col.name, x + 35, colY + 17);

        // Draw column type
        ctx.fillStyle = isDarkMode ? '#9ca3af' : '#6b7280';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(col.type, x + 260, colY + 17);
        ctx.textAlign = 'left';
      });
    });

    // Export
    const imageType = format === 'png' ? 'image/png' : 'image/jpeg';
    const imageQuality = format === 'jpeg' ? 0.95 : undefined;
    
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${diagramName.replace(/\s+/g, '_')}_diagram.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    }, imageType, imageQuality);

    setShowExportMenu(false);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        if (file.name.endsWith('.sql')) {
          // Basic SQL parsing
          const lines = content.split('\n');
          const newTables: Table[] = [];
          let currentTable: Table | null = null;
          let tableIndex = 0;

          lines.forEach(line => {
            const trimmed = line.trim();
            
            // Match CREATE TABLE
            const createMatch = trimmed.match(/CREATE TABLE (\w+)/i);
            if (createMatch) {
              if (currentTable) newTables.push(currentTable);
              currentTable = {
                id: `table_${Date.now()}_${tableIndex++}`,
                name: createMatch[1],
                x: 100 + tableIndex * 350,
                y: 100,
                columns: []
              };
            }
            
            // Match columns
            if (currentTable && trimmed.match(/^\w+\s+(INTEGER|VARCHAR|INT|TEXT|TIMESTAMP|BOOLEAN)/i)) {
              const parts = trimmed.split(/\s+/);
              const colName = parts[0].replace(/[,()]/g, '');
              const colType = parts[1].replace(/[,()]/g, '');
              const isPK = trimmed.toUpperCase().includes('PRIMARY KEY');
              const isNullable = !trimmed.toUpperCase().includes('NOT NULL');
              
              currentTable.columns.push({
                id: `col_${Date.now()}_${currentTable.columns.length}`,
                name: colName,
                type: colType === 'INTEGER' || colType === 'INT' ? 'Int' :
                  colType === 'VARCHAR' || colType === 'TEXT' ? 'String' :
                    colType === 'TIMESTAMP' ? 'DateTime' :
                      colType === 'BOOLEAN' ? 'Boolean' : 'String',
                isPrimaryKey: isPK,
                isForeignKey: false,
                isNullable: isNullable,
                isUnique: undefined
              });
            }
            
            // End of table
            if (trimmed.includes(');') && currentTable) {
              newTables.push(currentTable);
              currentTable = null;
            }
          });

          if (currentTable) newTables.push(currentTable);
          
          if (newTables.length > 0) {
            setTables(newTables);
            alert(`Successfully imported ${newTables.length} table(s)`);
          } else {
            alert('No tables found in SQL file');
          }
        } else if (file.name.endsWith('.prisma')) {
          // Parse Prisma schema (use the existing parseCode logic from CodeEditor)
          const lines = content.split('\n').filter(l => l.trim() && !l.trim().startsWith('//'));
          const newTables: Table[] = [];
          let currentTable: Table | null = null;
          let tableIndex = 0;

          lines.forEach(line => {
            const trimmed = line.trim();
            
            if (trimmed.startsWith('generator ') || trimmed.startsWith('datasource ') || trimmed.startsWith('enum ')) {
              return;
            }
            
            if (trimmed.startsWith('model ')) {
              if (currentTable) newTables.push(currentTable);
              
              const tableName = trimmed.split(' ')[1].replace('{', '').trim();
              currentTable = {
                id: `table_${Date.now()}_${tableIndex++}`,
                name: tableName,
                x: 100 + tableIndex * 350,
                y: 100,
                columns: []
              };
            } else if (trimmed === '}') {
              if (currentTable) {
                newTables.push(currentTable);
                currentTable = null;
              }
            } else if (currentTable && !trimmed.includes('@relation')) {
              const parts = trimmed.split(/\s+/);
              if (parts.length >= 2) {
                const colName = parts[0];
                let colType = parts[1].replace('?', '').replace('[]', '');
                const isNullable = parts[1].includes('?');
                const isPrimaryKey = trimmed.includes('@id');
                
                const standardTypes = ['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'Bytes', 'Decimal', 'BigInt'];
                if (!standardTypes.includes(colType) && colType[0] === colType[0].toUpperCase()) {
                  return;
                }
                
                currentTable.columns.push({
                  id: `col_${Date.now()}_${currentTable.columns.length}`,
                  name: colName,
                  type: colType,
                  isPrimaryKey,
                  isForeignKey: false,
                  isNullable,
                  isUnique: undefined
                });
              }
            }
          });

          if (currentTable) newTables.push(currentTable);
          
          if (newTables.length > 0) {
            setTables(newTables);
            alert(`Successfully imported ${newTables.length} table(s)`);
          } else {
            alert('No tables found in Prisma file');
          }
        } else {
          alert('Unsupported file format. Please use .sql or .prisma files.');
        }
      } catch (err) {
        alert('Error importing file: ' + (err instanceof Error ? err.message : String(err)));
      }
    };

    reader.readAsText(file);
    
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetZoom = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const clearAll = () => {
    if (confirm('Are you sure you want to clear all tables and relationships?')) {
      setTables([]);
      setRelationships([]);
      setDiagramName('Untitled Diagram');
    }
  };

  const pendingLine = pendingRelationship ? {
    fromX: pendingRelationship.x,
    fromY: pendingRelationship.y,
    toX: mousePos.x,
    toY: mousePos.y
  } : null;

  return (
    <div className={`h-screen flex ${isDarkMode ? 'bg-gray-950' : 'bg-gray-50'}`}>
      {/* Code Editor */}
      <div className={`w-96 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
        <CodeEditor
          tables={tables}
          relationships={relationships}
          onApplyCode={(newTables, newRels) => {
            setTables(newTables);
            setRelationships(newRels);
          }}
          isDarkMode={isDarkMode}
        />
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className={`border-b ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Database className={`${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} size={28} />
                <h1 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  DB Designer
                </h1>
              </div>
              <div className="h-8 w-px bg-gray-300"></div>
              <input
                type="text"
                value={diagramName}
                onChange={(e) => setDiagramName(e.target.value)}
                className={`text-base font-medium px-3 py-1.5 rounded-md border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDarkMode 
                    ? 'bg-gray-800 border-gray-700 text-gray-200' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                placeholder="Untitled Diagram"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={addTable}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium transition-colors"
              >
                <Plus size={18} />
                <span>New Table</span>
              </button>
              <button
                onClick={exportSQL}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-medium transition-colors"
              >
                <Download size={18} />
                <span>Export SQL</span>
              </button>
              
              {/* Export Image Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 font-medium transition-colors"
                >
                  <ImageIcon size={18} />
                  <span>Export Image</span>
                </button>
                {showExportMenu && (
                  <div className={`absolute right-0 mt-2 w-40 rounded-md shadow-lg ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'} z-50`}>
                    <div className="py-1">
                      <button
                        onClick={() => exportAsImage('png')}
                        className={`w-full text-left px-4 py-2 text-sm ${isDarkMode ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}
                      >
                        Export as PNG
                      </button>
                      <button
                        onClick={() => exportAsImage('jpeg')}
                        className={`w-full text-left px-4 py-2 text-sm ${isDarkMode ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}
                      >
                        Export as JPEG
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={clearAll}
                className="flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors bg-red-600 text-white hover:bg-red-700"
              >
                <Trash2 size={18} />
                <span>Clear</span>
              </button>

              {/* Import Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 font-medium transition-colors"
              >
                <Upload size={18} />
                <span>Import</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".sql,.prisma"
                className="hidden"
                onChange={handleImportFile}
              />
              
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`p-2 rounded-md transition-colors ${
                  isDarkMode 
                    ? 'bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-700' 
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                }`}
                title="Toggle Theme"
              >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>
          </div>

          {/* Toolbar */}
          <div className={`px-6 py-3 border-t flex items-center justify-between ${
            isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center gap-2">
              <div className={`flex items-center rounded-md overflow-hidden border ${
                isDarkMode ? 'border-gray-700' : 'border-gray-300'
              }`}>
                <button
                  onClick={() => setActiveTool('select')}
                  className={`px-3 py-2 transition-colors ${
                    activeTool === 'select' 
                      ? 'bg-blue-600 text-white'
                      : isDarkMode 
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' 
                        : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                  title="Select (V)"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3l7 7m0 0l4-4m-4 4v10m0 0l-3-3m3 3l3-3"/>
                  </svg>
                </button>
                <button
                  onClick={() => setActiveTool(activeTool === 'hand' ? 'select' : 'hand')}
                  className={`px-3 py-2 border-l transition-colors ${
                    isDarkMode ? 'border-gray-700' : 'border-gray-300'
                  } ${
                    activeTool === 'hand' 
                      ? 'bg-blue-600 text-white'
                      : isDarkMode 
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' 
                        : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                  title="Pan (H)"
                >
                  <Hand size={18} />
                </button>
              </div>

              <div className="w-px h-6 bg-gray-300 mx-2"></div>

              <div className={`flex items-center gap-1 px-2 py-1 rounded-md ${
                isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-300'
              }`}>
                <span className={`text-xs font-medium px-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Relationships:
                </span>
                <button
                  onClick={() => setActiveTool('one-to-one')}
                  className={`px-2 py-1 rounded transition-colors ${
                    activeTool === 'one-to-one' 
                      ? 'bg-green-600 text-white' 
                      : isDarkMode 
                        ? 'text-gray-300 hover:bg-gray-700' 
                        : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  title="One to One (1)"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="6" cy="12" r="3"/>
                    <circle cx="18" cy="12" r="3"/>
                    <path d="M9 12h6"/>
                  </svg>
                </button>
                <button
                  onClick={() => setActiveTool('one-to-many')}
                  className={`px-2 py-1 rounded transition-colors ${
                    activeTool === 'one-to-many' 
                      ? 'bg-blue-600 text-white' 
                      : isDarkMode 
                        ? 'text-gray-300 hover:bg-gray-700' 
                        : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  title="One to Many (2)"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="6" cy="12" r="3"/>
                    <path d="M9 12h6M15 12l-2-2m2 2l-2 2M18 9l3 3-3 3"/>
                  </svg>
                </button>
                <button
                  onClick={() => setActiveTool('many-to-many')}
                  className={`px-2 py-1 rounded transition-colors ${
                    activeTool === 'many-to-many' 
                      ? 'bg-purple-600 text-white' 
                      : isDarkMode 
                        ? 'text-gray-300 hover:bg-gray-700' 
                        : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  title="Many to Many (3)"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l3 3-3 3M18 9l-3 3 3 3M9 12h6"/>
                  </svg>
                </button>
              </div>
            </div>

            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${
              isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-300'
            }`}>
              <button
                onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                className={`p-1 rounded hover:bg-gray-700 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
              >
                <ZoomOut size={16} />
              </button>
              <span className={`text-sm font-medium min-w-[50px] text-center ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(Math.min(2, zoom + 0.1))}
                className={`p-1 rounded hover:bg-gray-700 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
              >
                <ZoomIn size={16} />
              </button>
              <div className="w-px h-4 bg-gray-600 mx-1"></div>
              <button
                onClick={resetZoom}
                className={`p-1 rounded hover:bg-gray-700 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
                title="Reset View (0)"
              >
                <Minimize2 size={16} />
              </button>
            </div>

            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {tables.length} {tables.length === 1 ? 'table' : 'tables'} · {relationships.length} {relationships.length === 1 ? 'relationship' : 'relationships'}
            </div>
          </div>
        </header>

        {/* Canvas */}
        <div className="flex-1 relative">
          <div
            ref={canvasRef}
            className={`h-full relative overflow-hidden ${
              activeTool === 'hand' ? 'cursor-grab active:cursor-grabbing' : 
              pendingRelationship ? 'cursor-crosshair' : 'cursor-default'
            } ${isDarkMode ? 'bg-gray-950' : 'bg-gray-50'}`}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            <Canvas
              tables={tables}
              relationships={relationships}
              zoom={zoom}
              offset={offset}
              pendingLine={pendingLine}
              isDarkMode={isDarkMode}
              onRelationshipClick={handleRelationshipClick}
            />
            
            <div style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
              {tables.map(table => (
                <TableCard
                  key={table.id}
                  table={table}
                  onUpdateTable={updateTable}
                  onDeleteTable={deleteTable}
                  onAddRelationship={addRelationship}
                  isDragging={draggingTable === table.id}
                  onDragStart={handleDragStart}
                  isDarkMode={isDarkMode}
                />
              ))}
            </div>

            {pendingRelationship && (
              <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm font-medium">
                Click a column to complete the relationship
              </div>
            )}

            {editingRelationship && (
              <div
                className={`absolute z-50 rounded-lg shadow-xl border ${
                  isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
                }`}
                style={{
                  left: editingRelationship.x,
                  top: editingRelationship.y,
                  transform: 'translate(-50%, -100%) translateY(-10px)'
                }}
              >
                <div className="p-2">
                  <button
                    onClick={() => updateRelationshipType(editingRelationship.rel.id, 'one-to-one')}
                    className={`w-full text-left px-3 py-2 rounded text-sm ${
                      editingRelationship.rel.type === 'one-to-one'
                        ? 'bg-green-600 text-white'
                        : isDarkMode
                          ? 'text-gray-300 hover:bg-gray-700'
                          : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    One to One (1:1)
                  </button>
                  <button
                    onClick={() => updateRelationshipType(editingRelationship.rel.id, 'one-to-many')}
                    className={`w-full text-left px-3 py-2 rounded text-sm ${
                      editingRelationship.rel.type === 'one-to-many'
                        ? 'bg-blue-600 text-white'
                        : isDarkMode
                          ? 'text-gray-300 hover:bg-gray-700'
                          : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    One to Many (1:N)
                  </button>
                  <button
                    onClick={() => updateRelationshipType(editingRelationship.rel.id, 'many-to-many')}
                    className={`w-full text-left px-3 py-2 rounded text-sm ${
                      editingRelationship.rel.type === 'many-to-many'
                        ? 'bg-purple-600 text-white'
                        : isDarkMode
                          ? 'text-gray-300 hover:bg-gray-700'
                          : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Many to Many (N:M)
                  </button>
                  <div className={`border-t my-1 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}></div>
                  <button
                    onClick={() => deleteRelationship(editingRelationship.rel.id)}
                    className="w-full text-left px-3 py-2 rounded text-sm text-red-600 hover:bg-red-50"
                  >
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
