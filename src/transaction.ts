import { intoTransaction, IntoTransaction, isIntoTransaction } from './intoTransaction'
import { TransactionExecutor } from './transactionExecutor'
import { Subtype, Uniontype } from './util'

type ExtractType<TS extends IntoTransaction<any, any>[]> = {
  [K in keyof TS]: TS[K] extends IntoTransaction<infer T, any> ? T : never
}
type ExtractContext<TS extends IntoTransaction<any, any>[]> = {
  [K in keyof TS]: TS[K] extends IntoTransaction<any, infer C> ? C : never
}

export class Transaction<T, Context = unknown> implements IntoTransaction<T, Context> {
  private _f: (context: Context) => Promise<T>

  constructor(f: (context: Context) => Promise<T>) {
    this._f = f
  }

  run(context: Context): Promise<T> {
    return this._f(context)
  }

  exec(executor: TransactionExecutor<Context>): Promise<T> {
    return executor(this)
  }

  [intoTransaction](): Transaction<T, Context> {
    return this
  }

  static of<Context = unknown>(): Transaction<void, Context>
  static of<T, Context = unknown>(value: T): Transaction<T, Context>
  static of(value?: any): Transaction<any, any> {
    return new Transaction(() => Promise.resolve(value))
  }

  static throw<T = unknown, Context = unknown>(err: any): Transaction<T, Context> {
    return new Transaction(() => Promise.reject(err))
  }

  static from<T, Context>(from: IntoTransaction<T, Context>): Transaction<T, Context> {
    if (!isIntoTransaction(from)) {
      throw new TypeError('A provided value is not IntoTransaction')
    }
    return from[intoTransaction]()
  }

  static all<Transactions extends IntoTransaction<any, any>[]>(
    ...transactions: Transactions
  ): Transaction<ExtractType<Transactions>, Subtype<ExtractContext<Transactions>>> {
    return new Transaction<any, any>(ctx => Promise.all(transactions.map(tx => Transaction.from(tx).run(ctx))))
  }

  static race<Transactions extends IntoTransaction<any, any>[]>(
    ...transactions: Transactions
  ): Transaction<Uniontype<ExtractType<Transactions>>, Subtype<ExtractContext<Transactions>>> {
    return new Transaction<any, any>(ctx => Promise.race(transactions.map(tx => Transaction.from(tx).run(ctx))))
  }

  andThen<U, ContextU>(onComplete: (x: T) => IntoTransaction<U, ContextU>): Transaction<U, Context & ContextU> {
    return new Transaction(ctx => this.run(ctx).then(x => Transaction.from(onComplete(x)).run(ctx)))
  }
  chain<U, ContextU>(onComplete: (x: T) => IntoTransaction<U, ContextU>): Transaction<U, Context & ContextU> {
    return this.andThen(onComplete)
  }

  catch<Context2>(onRejected: (err: any) => IntoTransaction<T, Context2>): Transaction<T, Context & Context2> {
    return new Transaction(ctx => this.run(ctx).catch(e => Transaction.from(onRejected(e)).run(ctx)))
  }

  finally<Context2>(onFinally: () => IntoTransaction<void, Context2>): Transaction<T, Context & Context2> {
    return new Transaction(async ctx => {
      try {
        return await this.run(ctx)
      } finally {
        await Transaction.from(onFinally()).run(ctx)
      }
    })
  }

  map<S>(f: (x: T) => S): Transaction<S, Context> {
    return new Transaction(ctx => this.run(ctx).then(x => f(x)))
  }
}
