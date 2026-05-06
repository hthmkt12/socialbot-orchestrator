export function resolveTemplate(
  template: string,
  variables: Record<string, unknown>,
  stepOutputs: Map<string, Record<string, unknown>>
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, path: string) => {
    const trimmed = path.trim();

    if (trimmed.startsWith('steps.')) {
      const parts = trimmed.split('.');
      const stepId = parts[1];
      const outputPath = parts.slice(2);
      const stepOutput = stepOutputs.get(stepId);
      if (!stepOutput) return '';
      let value: unknown = stepOutput;
      for (const p of outputPath) {
        if (value && typeof value === 'object') {
          value = (value as Record<string, unknown>)[p];
        } else {
          return '';
        }
      }
      return String(value ?? '');
    }

    if (trimmed in variables) {
      return String(variables[trimmed] ?? '');
    }

    return '';
  });
}

export function resolveParams(
  params: Record<string, unknown>,
  variables: Record<string, unknown>,
  stepOutputs: Map<string, Record<string, unknown>>
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      resolved[key] = resolveTemplate(value, variables, stepOutputs);
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

export function evaluateCondition(
  left: string,
  operator: string,
  right: string
): boolean {
  switch (operator) {
    case 'equals':
      return left === right;
    case 'not_equals':
      return left !== right;
    case 'contains':
      return left.includes(right);
    case 'starts_with':
      return left.startsWith(right);
    case 'ends_with':
      return left.endsWith(right);
    case 'gt': {
      const l = Number(left), r = Number(right);
      return !isNaN(l) && !isNaN(r) ? l > r : left > right;
    }
    case 'lt': {
      const l = Number(left), r = Number(right);
      return !isNaN(l) && !isNaN(r) ? l < r : left < right;
    }
    default:
      return false;
  }
}
