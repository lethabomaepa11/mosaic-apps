/** Accept only Cloud project destinations supplied by the sign-in screen. */
export function loginReturn(value: string | null | undefined): string {
  return value && /^\/projects\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}(?:\?tab=source)?$/i.test(value) ? value : '/';
}
