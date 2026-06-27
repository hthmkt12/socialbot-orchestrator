import { describe, it, expect } from 'vitest';
import { ExecutionContext } from './execution-context';

describe('ExecutionContext', () => {
  it('should initialize with variables', () => {
    const ctx = new ExecutionContext({ foo: 'bar' });
    expect(ctx.get('foo')).toBe('bar');
  });

  it('should set and get variables', () => {
    const ctx = new ExecutionContext();
    ctx.set('test', 123);
    expect(ctx.get('test')).toBe(123);
  });

  it('should interpolate strings', () => {
    const ctx = new ExecutionContext({ name: 'world' });
    expect(ctx.interpolate('hello {{name}}')).toBe('hello world');
  });

  it('should interpolate objects recursively', () => {
    const ctx = new ExecutionContext({ count: 5 });
    const obj = { text: 'items: {{count}}', nested: { val: '{{count}}' } };
    const interpolated: any = ctx.interpolate(obj);
    expect(interpolated.text).toBe('items: 5');
    expect(interpolated.nested.val).toBe('5');
  });

  it('should leave unknown variables as is', () => {
    const ctx = new ExecutionContext();
    expect(ctx.interpolate('hello {{unknown}}')).toBe('hello {{unknown}}');
  });
});
