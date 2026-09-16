import { vi } from 'vitest'

// A fake chainable Postgrest query builder. Every filter/modifier method
// just returns the same builder (so `.select().eq().order()` chains freely
// regardless of order or count), and the builder itself is a thenable that
// resolves to the {data, error} pair it was built with — mirroring how
// supabase-js's real query builder is awaitable without a final execute
// call.
export function chainable(result) {
  const builder = {}
  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is',
    'order', 'single', 'maybeSingle', 'limit'
  ]
  for (const m of methods) builder[m] = vi.fn(() => builder)
  builder.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject)
  builder.catch = (onReject) => Promise.resolve(result).catch(onReject)
  return builder
}
