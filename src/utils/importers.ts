// utils/importers.ts
import { Table, Column, Relationship } from '@/types/database';

export const importFromSQL = (sqlContent: string): { tables: Table[], relationships: Relationship[] } => {
  const tables: Table[] = [];
  const relationships: Relationship[] = [];
  
  // Remove comments and normalize whitespace
  const cleanSQL = sqlContent
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();

  // Match CREATE TABLE statements
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?\s*\(([\s\S]*?)\);/gi;
  let match;
  let tableIndex = 0;

  while ((match = tableRegex.exec(cleanSQL)) !== null) {
    const tableName = match[1];
    const tableContent = match[2];
    
    const columns: Column[] = [];
    const foreignKeys: Array<{ from: string, toTable: string, to: string }> = [];

    // Split by comma, but not within parentheses
    const columnDefs = tableContent.split(/,(?![^(]*\))/);

    columnDefs.forEach((colDef, colIndex) => {
      const trimmed = colDef.trim();
      
      // Check if it's a foreign key constraint
      if (trimmed.match(/FOREIGN\s+KEY/i)) {
        const fkMatch = trimmed.match(/FOREIGN\s+KEY\s*\(`?(\w+)`?\)\s*REFERENCES\s*`?(\w+)`?\s*\(`?(\w+)`?\)/i);
        if (fkMatch) {
          foreignKeys.push({
            from: fkMatch[1],
            toTable: fkMatch[2],
            to: fkMatch[3]
          });
        }
        return;
      }

      // Parse column definition
      const parts = trimmed.split(/\s+/);
      if (parts.length < 2) return;

      const colName = parts[0].replace(/`/g, '');
      let colType = parts[1].toUpperCase();
      
      // Convert SQL types to our types
      if (colType.includes('INT')) colType = 'Int';
      else if (colType.includes('VARCHAR') || colType.includes('TEXT') || colType.includes('CHAR')) colType = 'String';
      else if (colType.includes('BOOL')) colType = 'Boolean';
      else if (colType.includes('TIMESTAMP') || colType.includes('DATE')) colType = 'DateTime';
      else if (colType.includes('FLOAT') || colType.includes('DOUBLE') || colType.includes('DECIMAL')) colType = 'Float';
      else colType = 'String';

      const isPrimaryKey = trimmed.match(/PRIMARY\s+KEY/i) !== null;
      const isNotNull = trimmed.match(/NOT\s+NULL/i) !== null;
      const isUnique = trimmed.match(/UNIQUE/i) !== null;
      const defaultMatch = trimmed.match(/DEFAULT\s+([^\s,]+)/i);
      
      columns.push({
        id: `col_${Date.now()}_${colIndex}`,
        name: colName,
        type: colType,
        isPrimaryKey,
        isForeignKey: false,
        isNullable: !isNotNull && !isPrimaryKey,
        isUnique,
        defaultValue: defaultMatch ? defaultMatch[1] : undefined
      });
    });

    // Position tables in a grid
    const col = tableIndex % 3;
    const row = Math.floor(tableIndex / 3);
    
    const table: Table = {
      id: `table_${Date.now()}_${tableIndex}`,
      name: tableName,
      x: 100 + col * 400,
      y: 100 + row * 400,
      columns
    };

    tables.push(table);
    
    // Store foreign keys for later processing
    foreignKeys.forEach(fk => {
      const fromCol = columns.find(c => c.name === fk.from);
      if (fromCol) {
        fromCol.isForeignKey = true;
      }
    });

    tableIndex++;
  }

  // Parse ALTER TABLE statements for foreign keys
  const alterRegex = /ALTER\s+TABLE\s+`?(\w+)`?\s+ADD\s+(?:CONSTRAINT\s+\w+\s+)?FOREIGN\s+KEY\s*\(`?(\w+)`?\)\s*REFERENCES\s*`?(\w+)`?\s*\(`?(\w+)`?\)/gi;
  
  while ((match = alterRegex.exec(cleanSQL)) !== null) {
    const fromTableName = match[1];
    const fromColName = match[2];
    const toTableName = match[3];
    const toColName = match[4];

    const fromTable = tables.find(t => t.name === fromTableName);
    const toTable = tables.find(t => t.name === toTableName);
    const fromCol = fromTable?.columns.find(c => c.name === fromColName);
    const toCol = toTable?.columns.find(c => c.name === toColName);

    if (fromTable && toTable && fromCol && toCol) {
      fromCol.isForeignKey = true;
      
      relationships.push({
        id: `rel_${Date.now()}_${relationships.length}`,
        fromTableId: fromTable.id,
        fromColumnId: fromCol.id,
        toTableId: toTable.id,
        toColumnId: toCol.id,
        type: 'one-to-many',
        onUpdate: undefined,
        onDelete: undefined
      });
    }
  }

  return { tables, relationships };
};

export const importFromPrisma = (prismaContent: string): { tables: Table[], relationships: Relationship[] } => {
  const tables: Table[] = [];
  const relationships: Relationship[] = [];
  
  const lines = prismaContent.split('\n').filter(l => l.trim() && !l.trim().startsWith('//'));
  let currentTable: Table | null = null;
  let tableIndex = 0;

  const relationshipsToProcess: Array<{
    fromTable: string;
    fromField: string;
    toTable: string;
    toField: string;
  }> = [];

  lines.forEach((line, lineIndex) => {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('model ')) {
      if (currentTable) tables.push(currentTable);
      
      const tableName = trimmed.split(' ')[1].replace('{', '').trim();
      const col = tableIndex % 3;
      const row = Math.floor(tableIndex / 3);
      
      currentTable = {
        id: `table_${Date.now()}_${tableIndex++}`,
        name: tableName,
        x: 100 + col * 400,
        y: 100 + row * 400,
        columns: []
      };
    } else if (trimmed === '}') {
      if (currentTable) {
        tables.push(currentTable);
        currentTable = null;
      }
    } else if (currentTable && !trimmed.startsWith('generator') && !trimmed.startsWith('datasource')) {
      if (trimmed.includes('@relation')) {
        const parts = trimmed.split(/\s+/);
        const fieldName = parts[0];
        const typeName = parts[1];
        
        const fieldsMatch = trimmed.match(/fields:\s*\[([^\]]+)\]/);
        const referencesMatch = trimmed.match(/references:\s*\[([^\]]+)\]/);
        
        if (fieldsMatch && referencesMatch) {
          relationshipsToProcess.push({
            fromTable: currentTable.name,
            fromField: fieldsMatch[1].trim(),
            toTable: typeName,
            toField: referencesMatch[1].trim()
          });
        }
        return;
      }
      
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 2) {
        const colName = parts[0];
        let colType = parts[1].replace('?', '').replace('[]', '');
        const isNullable = parts[1].includes('?');
        const isPrimaryKey = trimmed.includes('@id');
        const isUnique = trimmed.includes('@unique');
        const defaultMatch = trimmed.match(/@default\(([^)]+)\)/);
        
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
          isUnique,
          defaultValue: defaultMatch ? defaultMatch[1] : undefined
        });
      }
    }
  });

  if (currentTable) tables.push(currentTable);
  
  relationshipsToProcess.forEach(rel => {
    const fromTable = tables.find(t => t.name === rel.fromTable);
    const toTable = tables.find(t => t.name === rel.toTable);
    
    if (fromTable && toTable) {
      const fromColumn = fromTable.columns.find(c => c.name === rel.fromField);
      const toColumn = toTable.columns.find(c => c.name === rel.toField);
      
      if (fromColumn && toColumn) {
        fromColumn.isForeignKey = true;
        relationships.push({
          id: `rel_${Date.now()}_${relationships.length}`,
          fromTableId: fromTable.id,
          fromColumnId: fromColumn.id,
          toTableId: toTable.id,
          toColumnId: toColumn.id,
          type: 'one-to-many',
          onUpdate: undefined,
          onDelete: undefined
        });
      }
    }
  });
  
  return { tables, relationships };
};
