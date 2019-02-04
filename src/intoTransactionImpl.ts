import { intoTransaction } from './intoTransactionSymbol'
import { IntoTransaction } from './intoTransaction'
import { Transaction } from './transaction'

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
  },
})
