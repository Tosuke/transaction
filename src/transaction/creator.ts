import { Transaction } from './transaction'
import { intoTransaction } from '../intoTransactionSymbol'
import { IntoTransaction, isIntoTransaction } from '../intoTransaction'
import { Loop } from '../loop'
import { Subtype, Uniontype } from '../util'

type ExtractType<TS extends IntoTransaction<any, any>[]> = {
  [K in keyof TS]: TS[K] extends IntoTransaction<infer T, any> ? T : never
}

type ExtractContext<TS extends IntoTransaction<any, any>[]> = {
  [K in keyof TS]: TS[K] extends IntoTransaction<any, infer C> ? C : never
}

type WithContextF<T, Context> = (context: Context) => Promise<T>
export function withContext<Context>(): <T>(f: WithContextF<T, Context>) => Transaction<T, Context>
export function withContext<T, Context = unknown>(f: WithContextF<T, Context>): Transaction<T, Context>
export function withContext<T, C>(f?: WithContextF<T, C>): unknown {
  if (f == null) {
    return withContextImpl
  } else {
    return withContextImpl(f)
  }
}
function withContextImpl<T, C>(f: WithContextF<T, C>): Transaction<T, C> {
  return new Transaction<T, C>(f)
}

export function of<Context = unknown>(): <T = void>(value?: T) => Transaction<T, Context>
export function of<T = void, Context = unknown>(value: T): Transaction<T, Context>
export function of<T, C>(value?: T): unknown {
  if (value === undefined) {
    return ofImpl
  } else {
    return ofImpl(value)
  }
}
function ofImpl(value?: any): Transaction<any, any> {
  return new Transaction(() => Promise.resolve(value))
}

export function throwError<T = never, Context = unknown>(reason: any): Transaction<T, Context> {
  return new Transaction(() => Promise.reject(reason))
}

export function from<T, Context>(from: IntoTransaction<T, Context>): Transaction<T, Context> {
  if (from instanceof Transaction) return from

  if (!isIntoTransaction(from)) {
    throw new TypeError('A provided value is not IntoTransaction')
  }

  return from[intoTransaction]()
}

export function fromLoop<S, T, Context>(
  initial: S,
  f: (state: S) => IntoTransaction<Loop<S, T>, Context>
): Transaction<T, Context> {
  return new Transaction(async ctx => {
    let state: S = initial
    while(true) {
      const loop = await from(f(state)).run(ctx)
      if (loop.type === 'continue') {
        state = loop.value
      } else {
        return loop.value
      }
    }
  })
}

export function join<Transactions extends IntoTransaction<any, any>[]>(
  ...transactions: Transactions
): Transaction<ExtractType<Transactions>, Subtype<ExtractContext<Transactions>>> {
  return new Transaction<any, any>(ctx => Promise.all(transactions.map(tx => from(tx).run(ctx))))
}

export function select<Transactions extends IntoTransaction<any, any>[]>(
  ...transactions: Transactions
): Transaction<Uniontype<ExtractType<Transactions>>, Subtype<ExtractContext<Transactions>>> {
  return new Transaction<any, any>(ctx => Promise.race(transactions.map(tx => from(tx).run(ctx))))
}