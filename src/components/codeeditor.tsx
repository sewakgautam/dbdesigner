// components/CodeEditor.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Table, Relationship, Column } from '@/types/database';
import { Copy, Check } from 'lucide-react';

interface CodeEditorProps {
  tables: Table[];
  relationships: Relationship[];
  onApplyCode: (tables: Table[], relationships: Relationship[]) => void;
  isDarkMode: boolean;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  tables,
  relationships,
  onApplyCode,
  isDarkMode
}) => {
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  // Generate code from tables when they change
  useEffect(() => {
    const newCode = generateCode(tables, relationships);
    setCode(newCode);
  }, [tables, relationships]);

  const generateCode = (tables: Table[], relationships: Relationship[]) => {
    let code = '// Prisma-like Schema\n';
    code += '// Edit this code and click "Apply Changes" to update your diagram\n\n';
    
    tables.forEach(table => {
      code += `model ${table.name} {\n`;
      
      table.columns.forEach(col => {
        let line = `  ${col.name.padEnd(15)} ${col.type}`;
        if (col.isPrimaryKey) {
          line += ' @id @default(autoincrement())';
        } else if (!col.isNullable) {
          line += '';
        } else {
          line += '?';
        }
        code += line + '\n';
      });
      
      // Add relationships
      const outgoingRels = relationships.filter(r => r.fromTableId === table.id);
      outgoingRels.forEach(rel => {
        const toTable = tables.find(t => t.id === rel.toTableId);
        const fromCol = table.columns.find(c => c.id === rel.fromColumnId);
        const toCol = toTable?.columns.find(c => c.id === rel.toColumnId);
        if (toTable && fromCol && toCol) {
          const relName = `${toTable.name.toLowerCase()}`;
          code += `  ${relName.padEnd(15)} ${toTable.name}  @relation(fields: [${fromCol.name}], references: [${toCol.name}])\n`;
        }
      });
      
      code += '}\n\n';
    });

    // Add relationship type comments
    if (relationships.length > 0) {
      code += '// Relationships:\n';
      relationships.forEach(rel => {
        const fromTable = tables.find(t => t.id === rel.fromTableId);
        const toTable = tables.find(t => t.id === rel.toTableId);
        const fromCol = fromTable?.columns.find(c => c.id === rel.fromColumnId);
        const toCol = toTable?.columns.find(c => c.id === rel.toColumnId);
        
        if (fromTable && toTable && fromCol && toCol) {
          const relType = rel.type === 'one-to-one' ? '1:1' : rel.type === 'one-to-many' ? '1:N' : 'N:M';
          code += `// ${fromTable.name}.${fromCol.name} -> ${toTable.name}.${toCol.name} (${relType})\n`;
        }
      });
    }

    return code;
  };

  const parseCode = (codeText: string): { tables: Table[], relationships: Relationship[] } => {
    const lines = codeText.split('\n').filter(l => l.trim() && !l.trim().startsWith('//'));
    const newTables: Table[] = [];
    const newRelationships: Relationship[] = [];
    let currentTable: Table | null = null;
    let tableIndex = 0;

    // Find existing table positions to prevent overlap
    let nextX = 100;
    let nextY = 100;
    const relationshipsToProcess: Array<{
      fromTable: string;
      fromField: string;
      toTable: string;
      toField: string;
    }> = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      
      // Skip generator, datasource, enum blocks
      if (trimmed.startsWith('generator ') || trimmed.startsWith('datasource ') || trimmed.startsWith('enum ')) {
        return;
      }
      
      if (trimmed.startsWith('model ')) {
        if (currentTable) newTables.push(currentTable);
        
        const tableName = trimmed.split(' ')[1].replace('{', '').trim();
        
        // Try to find existing position for this table
        const existingTable = tables.find(t => t.name === tableName);
        let x, y;
        
        if (existingTable) {
          x = existingTable.x;
          y = existingTable.y;
        } else {
          // Find non-overlapping position
          x = nextX;
          y = nextY;
          nextX += 350;
          if (nextX > 1200) {
            nextX = 100;
            nextY += 350;
          }
        }
        
        currentTable = {
          id: existingTable?.id || `table_${Date.now()}_${tableIndex++}`,
          name: tableName,
          x,
          y,
          columns: []
        };
      } else if (trimmed === '}') {
        if (currentTable) {
          newTables.push(currentTable);
          currentTable = null;
        }
      } else if (currentTable) {
        // Check if this line contains @relation
        if (trimmed.includes('@relation')) {
          const parts = trimmed.split(/\s+/);
          const fieldName = parts[0];
          const typeName = parts[1];
          
          // Extract relation details: @relation(fields: [fieldA], references: [fieldB])
          const fieldsMatch = trimmed.match(/fields:\s*\[([^\]]+)\]/);
          const referencesMatch = trimmed.match(/references:\s*\[([^\]]+)\]/);
          
          if (fieldsMatch && referencesMatch) {
            const fromField = fieldsMatch[1].trim();
            const toField = referencesMatch[1].trim();
            
            relationshipsToProcess.push({
              fromTable: currentTable.name,
              fromField: fromField,
              toTable: typeName,
              toField: toField
            });
          }
          
          // Don't add relation fields as columns
          return;
        }
        
        // Parse regular field
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 2) {
          const colName = parts[0];
          let colType = parts[1].replace('?', '').replace('[]', '');
          const isNullable = parts[1].includes('?');
          const isPrimaryKey = trimmed.includes('@id');
          const isArray = parts[1].includes('[]');
          
          // Skip if it's a relation type (starts with uppercase and not a standard type)
          const standardTypes = ['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'Bytes', 'Decimal', 'BigInt'];
          if (!standardTypes.includes(colType) && colType[0] === colType[0].toUpperCase()) {
            return; // Skip relation fields without @relation
          }
          
          currentTable.columns.push({
            id: `col_${Date.now()}_${currentTable.columns.length}`,
            name: colName,
            type: isArray ? `${colType}[]` : colType,
            isPrimaryKey,
            isForeignKey: false,
            isNullable,
            isUnique: undefined
          });
        }
      }
    });

    if (currentTable) newTables.push(currentTable);
    
    // Process relationships
    relationshipsToProcess.forEach(rel => {
      const fromTable = newTables.find(t => t.name === rel.fromTable);
      const toTable = newTables.find(t => t.name === rel.toTable);
      
      if (fromTable && toTable) {
        const fromColumn = fromTable.columns.find(c => c.name === rel.fromField);
        const toColumn = toTable.columns.find(c => c.name === rel.toField);
        
        if (fromColumn && toColumn) {
          newRelationships.push({
            id: `rel_${Date.now()}_${newRelationships.length}`,
            fromTableId: fromTable.id,
            fromColumnId: fromColumn.id,
            toTableId: toTable.id,
            toColumnId: toColumn.id,
            type: 'one-to-many' // Default, can be inferred from field types
            ,
            onUpdate: undefined,
            onDelete: undefined
          });
        }
      }
    });
    
    return { tables: newTables, relationships: newRelationships };
  };

  const handleApply = () => {
    try {
      const parsed = parseCode(code);
      if (parsed.tables.length > 0) {
        onApplyCode(parsed.tables, parsed.relationships);
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      alert('Error parsing code: ' + errorMessage);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`h-full flex flex-col ${isDarkMode ? 'bg-gray-900 border-r border-gray-800' : 'bg-gray-50 border-r border-gray-200'}`}>
      <div className={`p-4 border-b flex justify-between items-center ${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div>
          <h2 className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Schema Code
          </h2>
          <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Edit code and click Apply
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleApply}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
          >
            Apply Changes
          </button>
          <button
            onClick={handleCopy}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              isDarkMode 
                ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className={`flex-1 p-4 font-mono text-sm resize-none focus:outline-none ${
          isDarkMode 
            ? 'bg-gray-900 text-gray-100' 
            : 'bg-white text-gray-900'
        }`}
        spellCheck={false}
        placeholder="// Write your schema here..."
      />
      <div className={`p-3 border-t text-xs ${
        isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-600'
      }`}>
        <p className="font-semibold mb-1">Syntax:</p>
        <p>model TableName {'{ fieldName Type? @id @default(autoincrement()) }'}</p>
        <p className="mt-1">Types: Int | String | Boolean | DateTime | Float | Json</p>
      </div>
    </div>
  );
};
