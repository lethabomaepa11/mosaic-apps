/** Metadata routes use literal segments and named parameters; no executable regex. */
export function validatePageRoute(route: string): string {
  if (typeof route !== 'string' || !route.startsWith('/') || route.startsWith('//') || /[\\?#\u0000-\u001f]/.test(route) || route.length > 500) throw new Error('Page routes must be local paths, such as /orders/:id.');
  const parts = route.split('/').slice(1);
  const names = new Set<string>();
  for (const part of parts) {
    if (part === '.' || part === '..' || (part === '' && parts.length > 1)) throw new Error('Page routes cannot contain empty or relative segments.');
    if (part.includes(':')) {
      if (!/^:[A-Za-z_][A-Za-z0-9_]*$/.test(part) || names.has(part.slice(1))) throw new Error('Route parameters must have unique names, such as :id.');
      names.add(part.slice(1));
    } else if (/[{}*]/.test(part)) throw new Error('Use named route parameters instead of wildcards.');
  }
  return route;
}

export function matchPageRoute(route: string, pathname: string): Record<string, string> | null {
  try { validatePageRoute(route); } catch { return null; }
  if (!pathname.startsWith('/') || pathname.startsWith('//') || /[\\?#]/.test(pathname)) return null;
  const pattern = route.split('/');
  const values = pathname.split('/');
  if (pattern.length !== values.length) return null;
  const params: Record<string, string> = {};
  for (let index = 1; index < pattern.length; index++) {
    let value: string;
    try { value = decodeURIComponent(values[index]!); } catch { return null; }
    if (pattern[index]!.startsWith(':')) {
      if (!value || value === '.' || value === '..' || /[\/\\\u0000-\u001f]/.test(value)) return null;
      params[pattern[index]!.slice(1)] = value;
    } else if (pattern[index] !== values[index]) return null;
  }
  return params;
}

export function buildPageRoute(route: string, params: Record<string, unknown> = {}): string {
  validatePageRoute(route);
  return route.split('/').map(part => {
    if (!part.startsWith(':')) return part;
    const key = part.slice(1);
    const value = Object.hasOwn(params, key) ? params[key] : undefined;
    if (value === undefined || value === null || value === '' || !['string', 'number'].includes(typeof value)) throw new Error(`Choose a value for route parameter ${key}.`);
    const text = String(value);
    if (text === '.' || text === '..' || /[\/\\\u0000-\u001f]/.test(text)) throw new Error(`Invalid value for route parameter ${key}.`);
    return encodeURIComponent(text);
  }).join('/');
}

export function pageRouteSpecificity(route: string): number {
  return route.split('/').reduce((score, part) => score + (part.startsWith(':') ? 1 : 100), 0);
}
