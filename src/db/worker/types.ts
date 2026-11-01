export interface WorkerRequest<T = any> {
  id: string;
  action:
    | 'init'
    | 'exec'
    | 'batch'
    | 'explain'
    | 'exportDb'
    | 'importDb'
    | 'resetToSeed'
    | 'introspect'
    | 'createSandbox'
    | 'dropSandbox'
    | 'execSandbox'
    | 'callProcedure'
    | 'seedLargeBench';
  payload?: T;
  sandboxId?: string;
}

export interface WorkerResponse<T = any> {
  id: string;
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
  ms?: number;
}

export interface QueryResult {
  columns: string[];
  rows: any[][];
  rowsAffected: number;
  ms: number;
}

export interface IntrospectColumn {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: any;
  pk: number;
}

export interface IntrospectFk {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string;
  on_update: string;
  on_delete: string;
}

export interface IntrospectIndex {
  name: string;
  tbl_name: string;
  unique: boolean;
  sql?: string;
}

export interface IntrospectTrigger {
  name: string;
  tbl_name: string;
  sql: string;
}

export interface IntrospectView {
  name: string;
  sql: string;
}

export interface IntrospectTable {
  name: string;
  columns: IntrospectColumn[];
  fks: IntrospectFk[];
  indexes: IntrospectIndex[];
  rowCount: number;
}

export interface IntrospectResult {
  tables: IntrospectTable[];
  views: IntrospectView[];
  triggers: IntrospectTrigger[];
  indexes: IntrospectIndex[];
  userVersion: number;
  dbSizeBytes: number;
  tablesCount?: number;
  viewsCount?: number;
  triggersCount?: number;
  indexesCount?: number;
  totalRows?: number;
  sizeBytes?: number;
}
