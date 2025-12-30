// types/database.ts

export interface Column {
  isUnique: any;
  id: string;
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isNullable: boolean;
  defaultValue?: string;
}

export interface Table {
  id: string;
  name: string;
  x: number;
  y: number;
  columns: Column[];
}

export interface Relationship {
  onUpdate: any;
  onDelete: any;
  id: string;
  fromTableId: string;
  fromColumnId: string;
  toTableId: string;
  toColumnId: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
}

export interface DiagramState {
  tables: Table[];
  relationships: Relationship[];
}

export type Tool = 'select' | 'hand' | 'one-to-one' | 'one-to-many' | 'many-to-many';
