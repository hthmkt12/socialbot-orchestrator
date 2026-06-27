export class ExecutionContext {
  public variables: Record<string, unknown> = {};

  constructor(initialVars: Record<string, unknown> = {}) {
    this.variables = { ...initialVars };
  }

  public set(key: string, value: unknown) {
    this.variables[key] = value;
  }

  public get(key: string): unknown {
    return this.variables[key];
  }

  // Helper to replace {{var}} in strings/objects
  public interpolate(obj: unknown): unknown {
    if (typeof obj === 'string') {
      return obj.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
        const val = this.get(key.trim());
        return val !== undefined ? String(val) : match;
      });
    }

    if (Array.isArray(obj)) {
      return obj.map(v => this.interpolate(v));
    }

    if (obj !== null && typeof obj === 'object') {
      const res: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        res[k] = this.interpolate(v);
      }
      return res;
    }

    return obj;
  }
}