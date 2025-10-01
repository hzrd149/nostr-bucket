/** Log debug messages if in development mode */
export function debug(...args: unknown[]) {
  // @ts-expect-error
  if (process.env.NODE_ENV === "development") console.log(...args);
}
