declare module 'better-sqlite3' {
  interface RunResult {
    changes: number
    lastInsertRowid: number | bigint
  }

  interface Statement<BindParameters = unknown[]> {
    all(...params: BindParameters[]): any[]
    get(...params: BindParameters[]): any
    run(...params: BindParameters[]): RunResult
    iterate(...params: BindParameters[]): IterableIterator<any>
    pluck(toggle?: boolean): this
    expand(toggle?: boolean): this
    raw(toggle?: boolean): this
    columns(): { name: string; column: string | null; table: string | null; database: string | null; type: string }[]
    bind(...params: BindParameters[]): this
    reset(): this
    finalize(): this
  }

  export interface DBInstance {
    prepare(sql: string): Statement
    exec(sql: string): this
    transaction<T extends (...args: any[]) => any>(fn: T): T
    pragma(pragma: string, options?: { simple: boolean }): any
    close(): this
    open(): this
    inTransaction: boolean
    name: string
    readonly: boolean
    memory: boolean
    function(name: string, options?: { deterministic?: boolean; varargs?: boolean }, fn?: (...args: any[]) => any): this
    aggregate(name: string, options?: { deterministic?: boolean; varargs?: boolean }, fn?: any): this
  }

  interface DatabaseConstructor {
    new (filename: string, options?: any): DBInstance
  }

  const Database: DatabaseConstructor
  export default Database
}