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
  const foreignKeyStore: Array<{ fromTable: string, from: string, toTable: string, to: string }> = [];

  while ((match = tableRegex.exec(cleanSQL)) !== null) {
    const tableName = match[1];
    const tableContent = match[2];
    
    const columns: Column[] = [];

    // Split by comma, but not within parentheses
    const columnDefs = tableContent.split(/,(?![^(]*\))/);

    columnDefs.forEach((colDef, colIndex) => {
      const trimmed = colDef.trim();
      
      // Check if it's a foreign key constraint
      if (trimmed.match(/FOREIGN\s+KEY/i) || trimmed.match(/CONSTRAINT.*FOREIGN\s+KEY/i)) {
        const fkMatch = trimmed.match(/FOREIGN\s+KEY\s*\(`?(\w+)`?\)\s*REFERENCES\s*`?(\w+)`?\s*\(`?(\w+)`?\)/i);
        if (fkMatch) {
          foreignKeyStore.push({
            fromTable: tableName,
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
      let colType = parts[1].toUpperCase().replace(/\(.*\)/, '');
      
      // Convert SQL types to our types
      if (colType.includes('INT')) colType = 'Int';
      else if (colType.includes('VARCHAR') || colType.includes('TEXT') || colType.includes('CHAR')) colType = 'String';
      else if (colType.includes('BOOL')) colType = 'Boolean';
      else if (colType.includes('TIMESTAMP') || colType.includes('DATETIME') || colType.includes('DATE')) colType = 'DateTime';
      else if (colType.includes('FLOAT') || colType.includes('DOUBLE') || colType.includes('DECIMAL') || colType.includes('REAL')) colType = 'Float';
      else colType = 'String';

      const isPrimaryKey = trimmed.match(/PRIMARY\s+KEY/i) !== null;
      const isNotNull = trimmed.match(/NOT\s+NULL/i) !== null;
      const isUnique = trimmed.match(/UNIQUE/i) !== null;
      const defaultMatch = trimmed.match(/DEFAULT\s+([^\s,]+)/i);
      
      columns.push({
        id: `col_${Date.now()}_${tableIndex}_${colIndex}`,
        name: colName,
        type: colType,
        isPrimaryKey,
        isForeignKey: false, // Will be set later
        isNullable: !isNotNull && !isPrimaryKey,
        isUnique,
        defaultValue: defaultMatch ? defaultMatch[1].replace(/['"]/g, '') : undefined
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
    tableIndex++;
  }

  // Parse ALTER TABLE statements for foreign keys
  const alterRegex = /ALTER\s+TABLE\s+`?(\w+)`?\s+ADD\s+(?:CONSTRAINT\s+[\w_]+\s+)?FOREIGN\s+KEY\s*\(`?(\w+)`?\)\s*REFERENCES\s*`?(\w+)`?\s*\(`?(\w+)`?\)/gi;
  
  while ((match = alterRegex.exec(cleanSQL)) !== null) {
    foreignKeyStore.push({
      fromTable: match[1],
      from: match[2],
      toTable: match[3],
      to: match[4]
    });
  }

  // Process all foreign keys
  foreignKeyStore.forEach(fk => {
    const fromTable = tables.find(t => t.name === fk.fromTable);
    const toTable = tables.find(t => t.name === fk.toTable);
    const fromCol = fromTable?.columns.find(c => c.name === fk.from);
    const toCol = toTable?.columns.find(c => c.name === fk.to);

    if (fromTable && toTable && fromCol && toCol) {
      // Mark column as foreign key
      fromCol.isForeignKey = true;
      
      // Create relationship
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
  });

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
    
    // Skip generator and datasource blocks
    if (trimmed.startsWith('generator') || trimmed.startsWith('datasource')) {
      return;
    }
    
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
    } else if (currentTable) {
      // Check if this is a relation field
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
      
      // Parse regular field
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 2) {
        const colName = parts[0];
        let colType = parts[1].replace('?', '').replace('[]', '');
        const isNullable = parts[1].includes('?');
        const isPrimaryKey = trimmed.includes('@id');
        const isUnique = trimmed.includes('@unique');
        const defaultMatch = trimmed.match(/@default\(([^)]+)\)/);
        
        // Skip if it's a relation type (non-standard type)
        const standardTypes = ['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'Bytes', 'Decimal', 'BigInt'];
        if (!standardTypes.includes(colType) && colType[0] === colType[0].toUpperCase()) {
          return;
        }
        
        currentTable.columns.push({
          id: `col_${Date.now()}_${currentTable.columns.length}`,
          name: colName,
          type: colType,
          isPrimaryKey,
          isForeignKey: false, // Will be set when processing relationships
          isNullable,
          isUnique,
          defaultValue: defaultMatch ? defaultMatch[1] : undefined
        });
      }
    }
  });

  if (currentTable) tables.push(currentTable);
  
  // Process relationships
  relationshipsToProcess.forEach(rel => {
    const fromTable = tables.find(t => t.name === rel.fromTable);
    const toTable = tables.find(t => t.name === rel.toTable);
    
    if (fromTable && toTable) {
      const fromColumn = fromTable.columns.find(c => c.name === rel.fromField);
      const toColumn = toTable.columns.find(c => c.name === rel.toField);
      
      if (fromColumn && toColumn) {
        // Mark the column as a foreign key
        fromColumn.isForeignKey = true;
        
        // Create the relationship
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
