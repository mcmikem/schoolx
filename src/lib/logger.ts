// Structured logging utility for client and server
// In production, logs go to Sentry. In development, pretty-printed.
const isDev = process.env.NODE_ENV === 'development';
function fmt(args: unknown[]): string[] {
  return args.map((a) => {
    if (a instanceof Error) return isDev ? (a.stack ?? a.message) : a.message;
    if (typeof a === 'object' && a !== null) {
      try { return JSON.stringify(a, null, 2); } catch { return String(a); }
    }
    return String(a);
  });
}
export const logger = {
  log(...a: unknown[]) { if (isDev) console.log('[LOG]', ...fmt(a)); },
  debug(...a: unknown[]) { if (isDev) console.debug('[DEBUG]', ...fmt(a)); },
  info(...a: unknown[]) { if (isDev) console.info('[INFO]', ...fmt(a)); },
  warn(...a: unknown[]) { console.warn('[WARN]', ...fmt(a)); },
  error(...a: unknown[]) {
    if (isDev) console.error('[ERROR]', ...fmt(a));
    else console.error('[ERROR]', ...a.map((x: unknown) => x instanceof Error ? x.message : x));
  },
  group(l: string) { if (isDev) console.group('[' + l + ']'); },
  groupEnd() { if (isDev) console.groupEnd(); },
  time(l: string) { if (isDev) console.time(l); },
  timeEnd(l: string) { if (isDev) console.timeEnd(l); },
};
