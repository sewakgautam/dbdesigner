// components/TableCard.tsx
'use client';

import React, { useState } from 'react';
import { Table, Column } from '@/types/database';
import { GripVertical, Plus, Trash2, Key, Link } from 'lucide-react';

interface TableCardProps {
  table: Table;
  onUpdateTable: (table: Table) => void;
  onDeleteTable: (id: string) => void;
  onAddRelationship: (tableId: string, columnId: string, x: number, y: number) => void;
  isDragging: boolean;
  onDragStart: (e: React.MouseEvent, tableId: string) => void;
  isDarkMode: boolean;
}

export const TableCard: React.FC<TableCardProps> = ({
  table,
  onUpdateTable,
  onDeleteTable,
  onAddRelationship,
  isDragging,
  onDragStart,
  isDarkMode
}) => {
  const [editingName, setEditingName] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');

  const addColumn = () => {
    if (!newColumnName.trim()) return;
    
    const newColumn: Column = {
      id: `col_${Date.now()}`,
      name: newColumnName,
      type: 'String',
      isPrimaryKey: false,
      isForeignKey: false,
      isNullable: true
    };

    onUpdateTable({
      ...table,
      columns: [...table.columns, newColumn]
    });
    setNewColumnName('');
  };

  const updateColumn = (columnId: string, updates: Partial<Column>) => {
    onUpdateTable({
      ...table,
      columns: table.columns.map(col =>
        col.id === columnId ? { ...col, ...updates } : col
      )
    });
  };

  const deleteColumn = (columnId: string) => {
    onUpdateTable({
      ...table,
      columns: table.columns.filter(col => col.id !== columnId)
    });
  };

  const handleColumnClick = (e: React.MouseEvent, columnId: string) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.right;
    const y = rect.top + rect.height / 2;
    onAddRelationship(table.id, columnId, x, y);
  };

  return (
    <div
      className={`absolute rounded-lg shadow-lg border ${
        isDarkMode 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-300'
      }`}
      style={{
        left: table.x,
        top: table.y,
        width: 280,
        cursor: isDragging ? 'grabbing' : 'default'
      }}
    >
      {/* Header */}
      <div className={`p-3 rounded-t-lg flex items-center justify-between ${
        isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-800 text-white'
      }`}>
        <div
          className="flex items-center gap-2 cursor-grab active:cursor-grabbing flex-1"
          onMouseDown={(e) => onDragStart(e, table.id)}
        >
          <GripVertical size={16} />
          {editingName ? (
            <input
              type="text"
              value={table.name}
              onChange={(e) => onUpdateTable({ ...table, name: e.target.value })}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => e.key === 'Enter' && setEditingName(false)}
              className={`px-2 py-1 rounded text-sm flex-1 ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-700'
              }`}
              autoFocus
            />
          ) : (
            <span
              className="font-semibold flex-1"
              onDoubleClick={() => setEditingName(true)}
            >
              {table.name}
            </span>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteTable(table.id);
          }}
          className="hover:bg-gray-600 p-1 rounded"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Columns */}
      <div className="p-2">
        {table.columns.map((column) => (
          <div
            key={column.id}
            className={`flex items-center gap-2 p-2 rounded group cursor-pointer ${
              isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
            onClick={(e) => handleColumnClick(e, column.id)}
          >
            {column.isPrimaryKey && (
              <span title="Primary Key">
                <Key size={14} className="text-amber-500" />
              </span>
            )}
            {column.isForeignKey && !column.isPrimaryKey && (
              <span title="Foreign Key">
                <Link size={14} className="text-blue-500" />
              </span>
            )}
            <input
              type="text"
              value={column.name}
              onChange={(e) => {
                e.stopPropagation();
                updateColumn(column.id, { name: e.target.value });
              }}
              onClick={(e) => e.stopPropagation()}
              className={`flex-1 text-sm font-medium bg-transparent border-none outline-none ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}
            />
            <select
              value={column.type}
              onChange={(e) => {
                e.stopPropagation();
                updateColumn(column.id, { type: e.target.value });
              }}
              onClick={(e) => e.stopPropagation()}
              className={`text-xs bg-transparent border-none outline-none ${
                isDarkMode ? 'text-gray-300' : 'text-gray-600'
              }`}
            >
              <option>Int</option>
              <option>String</option>
              <option>Boolean</option>
              <option>DateTime</option>
              <option>Float</option>
              <option>Json</option>
            </select>
            <button
              onClick={(e) => {
                e.stopPropagation();
                updateColumn(column.id, { isPrimaryKey: !column.isPrimaryKey });
              }}
              className={`text-xs px-1 ${column.isPrimaryKey ? 'text-amber-600' : 'text-gray-400'}`}
              title="Primary Key"
            >
              PK
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteColumn(column.id);
              }}
              className="opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-700"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}

        {/* Add Column */}
        <div className={`flex gap-2 mt-2 pt-2 border-t ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <input
            type="text"
            value={newColumnName}
            onChange={(e) => setNewColumnName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addColumn()}
            placeholder="New column..."
            className={`flex-1 text-sm px-2 py-1 border rounded ${
              isDarkMode 
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          />
          <button
            onClick={addColumn}
            className={`p-1 rounded ${
              isDarkMode 
                ? 'bg-gray-700 text-white hover:bg-gray-600' 
                : 'bg-gray-800 text-white hover:bg-gray-700'
            }`}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
