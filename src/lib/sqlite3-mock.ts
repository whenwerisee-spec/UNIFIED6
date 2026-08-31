import fs from 'fs';

export class Database {
  private filePath: string;
  constructor(filePath: string, callback?: (err: Error | null) => void) {
    this.filePath = filePath;
    if (callback) {
      setTimeout(() => callback(null), 0);
    }
  }

  serialize(fn?: () => void) {
    if (typeof fn === 'function') {
      fn();
    }
  }

  parallelize(fn?: () => void) {
    if (typeof fn === 'function') {
      fn();
    }
  }

  run(sql: string, paramsOrCallback?: any, callback?: any) {
    let cb: any = null;
    if (typeof paramsOrCallback === 'function') {
      cb = paramsOrCallback;
    } else {
      cb = callback;
    }

    if (cb) {
      const ctx = { changes: 0, lastID: 0 };
      setTimeout(() => cb.call(ctx, null), 0);
    }
  }

  get(sql: string, paramsOrCallback?: any, callback?: any) {
    const cb = typeof paramsOrCallback === 'function' ? paramsOrCallback : callback;
    if (cb) {
      setTimeout(() => cb(null, null), 0);
    }
  }

  all(sql: string, paramsOrCallback?: any, callback?: any) {
    let params: any[] = [];
    let cb: any = null;
    if (typeof paramsOrCallback === 'function') {
      cb = paramsOrCallback;
    } else {
      params = paramsOrCallback || [];
      cb = callback;
    }
    if (cb) {
      setTimeout(() => cb(null, []), 0);
    }
  }

  exec(_sql: string, callback?: (err: Error | null) => void) {
    if (callback) {
      setTimeout(() => callback(null), 0);
    }
  }

  close(callback?: (err: Error | null) => void) {
    if (callback) {
      setTimeout(() => callback(null), 0);
    }
  }
}

const sqlite3Mock = {
  Database,
  verbose: () => sqlite3Mock
};

export default sqlite3Mock;
