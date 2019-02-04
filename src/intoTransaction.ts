import { intoTransaction } from './intoTransactionSymbol'
import { Transaction } from './transaction'

export interface IntoTransaction<T, Context> {
  [intoTransaction](): Transaction<T, Context>
}

export function isIntoTransaction(x: any): x is IntoTransaction<any, unknown> {
  return x[intoTransaction] != null && typeof x[intoTransaction] === 'function'
}
