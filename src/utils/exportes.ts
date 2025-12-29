// utils/exporters.ts
import { Table, Relationship } from '@/types/database';

export const exportToSQL = (tables: Table[], relationships: Relationship[], diagramName: string): string => {
  let sql = `-- Database Schema: ${diagramName}\n`;
  sql += `-- Generated: ${new Date().toISOString()}\n\n`;
  
  tables.forEach(table => {
    sql += `CREATE TABLE ${table.name} (\n`;
    sql += table.columns.map((col, idx) => {
      let line = `  ${col.name} ${col.type === 'Int' ? 'INTEGER' : col.type === 'String' ? 'VARCHAR(255)' : col.type === 'DateTime' ? 'TIMESTAMP' : col.type === 'Boolean' ? 'BOOLEAN' : col.type}`;
      if (col.isPrimaryKey) line += ' PRIMARY KEY';
      if (!col.isNullable) line += ' NOT NULL';
      if (col.defaultValue) line += ` DEFAULT ${col.defaultValue}`;
      if (col.isUnique) line += ' UNIQUE';
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
      sql += `  REFERENCES ${toTable.name}(${toCol.name})`;
      if (rel.onDelete) sql += `\n  ON DELETE ${rel.onDelete}`;
      if (rel.onUpdate) sql += `\n  ON UPDATE ${rel.onUpdate}`;
      sql += ';\n\n';
    }
  });

  return sql;
};

export const exportToTypeORM = (tables: Table[], relationships: Relationship[]): string => {
  let code = `// TypeORM Entities\n`;
  code += `import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, ManyToMany, JoinTable } from 'typeorm';\n\n`;
  
  tables.forEach(table => {
    code += `@Entity()\n`;
    code += `export class ${table.name} {\n`;
    
    table.columns.forEach(col => {
      if (col.isPrimaryKey) {
        code += `  @PrimaryGeneratedColumn()\n`;
      } else {
        let colOptions = '';
        if (!col.isNullable) colOptions += 'nullable: false';
        if (col.isUnique) colOptions += colOptions ? ', unique: true' : 'unique: true';
        if (col.defaultValue) colOptions += colOptions ? `, default: ${col.defaultValue}` : `default: ${col.defaultValue}`;
        code += `  @Column(${colOptions ? `{ ${colOptions} }` : ''})\n`;
      }
      code += `  ${col.name}${col.isNullable ? '?' : ''}: ${col.type.toLowerCase()};\n\n`;
    });
    
    code += `}\n\n`;
  });

  return code;
};

export const exportToSequelize = (tables: Table[], relationships: Relationship[]): string => {
  let code = `// Sequelize Models\n`;
  code += `import { DataTypes } from 'sequelize';\n`;
  code += `import sequelize from './database';\n\n`;
  
  tables.forEach(table => {
    code += `export const ${table.name} = sequelize.define('${table.name}', {\n`;
    
    table.columns.forEach((col, idx) => {
      code += `  ${col.name}: {\n`;
      code += `    type: DataTypes.${col.type.toUpperCase()},\n`;
      if (col.isPrimaryKey) code += `    primaryKey: true,\n    autoIncrement: true,\n`;
      if (!col.isNullable) code += `    allowNull: false,\n`;
      if (col.isUnique) code += `    unique: true,\n`;
      if (col.defaultValue) code += `    defaultValue: ${col.defaultValue},\n`;
      code += `  }${idx < table.columns.length - 1 ? ',' : ''}\n`;
    });
    
    code += `});\n\n`;
  });

  return code;
};

export const exportToDjango = (tables: Table[], relationships: Relationship[]): string => {
  let code = `# Django Models\n`;
  code += `from django.db import models\n\n`;
  
  tables.forEach(table => {
    code += `class ${table.name}(models.Model):\n`;
    
    table.columns.forEach(col => {
      if (col.isPrimaryKey) {
        code += `    ${col.name} = models.AutoField(primary_key=True)\n`;
      } else {
        let fieldType = 'CharField';
        if (col.type === 'Int') fieldType = 'IntegerField';
        else if (col.type === 'Boolean') fieldType = 'BooleanField';
        else if (col.type === 'DateTime') fieldType = 'DateTimeField';
        else if (col.type === 'Float') fieldType = 'FloatField';
        
        let options = [];
        if (col.type === 'String') options.push('max_length=255');
        if (col.isNullable) options.push('null=True', 'blank=True');
        if (col.isUnique) options.push('unique=True');
        if (col.defaultValue) options.push(`default=${col.defaultValue}`);
        
        code += `    ${col.name} = models.${fieldType}(${options.join(', ')})\n`;
      }
    });
    
    code += `\n    class Meta:\n`;
    code += `        db_table = '${table.name.toLowerCase()}'\n\n`;
  });

  return code;
};

export const exportToGraphQL = (tables: Table[], relationships: Relationship[]): string => {
  let code = `# GraphQL Schema\n\n`;
  
  tables.forEach(table => {
    code += `type ${table.name} {\n`;
    
    table.columns.forEach(col => {
      let gqlType = 'String';
      if (col.type === 'Int') gqlType = 'Int';
      else if (col.type === 'Boolean') gqlType = 'Boolean';
      else if (col.type === 'Float') gqlType = 'Float';
      else if (col.type === 'DateTime') gqlType = 'DateTime';
      
      code += `  ${col.name}: ${gqlType}${!col.isNullable ? '!' : ''}\n`;
    });
    
    // Add relationships
    relationships.forEach(rel => {
      if (rel.fromTableId === table.id) {
        const toTable = tables.find(t => t.id === rel.toTableId);
        if (toTable) {
          if (rel.type === 'one-to-many') {
            code += `  ${toTable.name.toLowerCase()}s: [${toTable.name}!]!\n`;
          } else if (rel.type === 'one-to-one') {
            code += `  ${toTable.name.toLowerCase()}: ${toTable.name}\n`;
          }
        }
      }
    });
    
    code += `}\n\n`;
  });

  // Add Query type
  code += `type Query {\n`;
  tables.forEach(table => {
    code += `  ${table.name.toLowerCase()}(id: Int!): ${table.name}\n`;
    code += `  ${table.name.toLowerCase()}s: [${table.name}!]!\n`;
  });
  code += `}\n\n`;

  // Add Mutation type
  code += `type Mutation {\n`;
  tables.forEach(table => {
    code += `  create${table.name}(input: ${table.name}Input!): ${table.name}!\n`;
    code += `  update${table.name}(id: Int!, input: ${table.name}Input!): ${table.name}!\n`;
    code += `  delete${table.name}(id: Int!): Boolean!\n`;
  });
  code += `}\n`;

  return code;
};

export const exportToPrisma = (tables: Table[], relationships: Relationship[]): string => {
  let code = `// Prisma Schema\n\n`;
  code += `generator client {\n  provider = "prisma-client-js"\n}\n\n`;
  code += `datasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}\n\n`;
  
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
      if (col.isUnique) line += ' @unique';
      if (col.defaultValue) line += ` @default(${col.defaultValue})`;
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
        code += `  ${relName.padEnd(15)} ${toTable.name}  @relation(fields: [${fromCol.name}], references: [${toCol.name}]`;
        if (rel.onDelete) code += `, onDelete: ${rel.onDelete}`;
        if (rel.onUpdate) code += `, onUpdate: ${rel.onUpdate}`;
        code += `)\n`;
      }
    });
    
    code += `}\n\n`;
  });

  return code;
};

export const downloadFile = (content: string, filename: string, mimeType: string = 'text/plain') => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
