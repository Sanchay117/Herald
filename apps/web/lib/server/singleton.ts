// Module state can be duplicated across route bundles and dev reloads; globalThis is shared by the whole server process.
export function singleton<T>(name: string, create: () => T): T {
  const store = globalThis as unknown as Record<symbol, T | undefined>
  const key = Symbol.for(`herald.${name}`)
  return (store[key] ??= create())
}
