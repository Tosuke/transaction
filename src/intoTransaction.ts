const NAME = '@@into_transaction@@'
export const intoTransaction = Symbol(NAME)

import { Transaction } from './transaction'

export interface IntoTransaction<T, Context> {
  [intoTransaction](): Transaction<T, Context>
}

export function isIntoTransaction(x: any): x is IntoTransaction<any, unknown> {
  return x[intoTransaction] != null && typeof x[intoTransaction] === 'function'
}

declare global {
  interface Promise<T> extends IntoTransaction<T, unknown> {
    [intoTransaction](): Transaction<T, unknown>
  }
}

Object.defineProperty(Promise.prototype, intoTransaction, {
  configurable: false,
  enumerable: false,
  writable: false,
  value() {
    return new Transaction<any, unknown>(() => this)
  }
})
