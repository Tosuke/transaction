import { intoTransaction, IntoTransaction, isIntoTransaction } from './intoTransaction'
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

  [intoTransaction]() {
    return this
  }

  static of<Context = unknown>(): Transaction<void, Context>
  static of<T, Context = unknown>(value: T): Transaction<T, Context>
  static of(value?: any): Transaction<any, any> {
    return new Transaction(() => Promise.resolve(value))
  }

  static throw<T = never, Context = unknown>(err: any): Transaction<T, Context> {
    return new Transaction(() => Promise.reject(err))
  }

  static from<T, Context>(from: IntoTransaction<T, Context>): Transaction<T, Context> {
    if (!isIntoTransaction(from)) {
      throw new TypeError("'from' is not IntoTransaction")
    }
    return from[intoTransaction]()
  }

  static all<Transactions extends IntoTransaction<any, any>[]>(
    ...transactions: Transactions
  ): Transaction<ExtractType<Transactions>, Subtype<ExtractContext<Transactions>>> {
    return new Transaction<any, any>(ctx => Promise.all(transactions.map(tx => tx[intoTransaction]().run(ctx))))
  }

  static race<Transactions extends IntoTransaction<any, any>[]>(
    ...transactions: Transactions
  ): Transaction<Uniontype<ExtractType<Transactions>>, Subtype<ExtractContext<Transactions>>> {
    return new Transaction<any, any>(ctx => Promise.race(transactions.map(tx => tx[intoTransaction]().run(ctx))))
  }

  then<U, ContextU>(onComplete: (x: T) => IntoTransaction<U, ContextU>): Transaction<U, Context & ContextU> {
    return new Transaction(ctx =>
      this.run(ctx).then(x =>
        onComplete(x)
          [intoTransaction]()
          .run(ctx),
      ),
    )
  }

  catch<Context2>(onRejected: (err: any) => IntoTransaction<T, Context2>): Transaction<T, Context & Context2> {
    return new Transaction(ctx =>
      this.run(ctx).catch(e =>
        onRejected(e)
          [intoTransaction]()
          .run(ctx),
      ),
    )
  }

  finally<Context2>(onFinally: () => IntoTransaction<void, Context2>): Transaction<T, Context & Context2> {
    return new Transaction(async ctx => {
      try {
        return await this.run(ctx)
      } finally {
        await onFinally()[intoTransaction]().run(ctx)
      }
    })
  }

  map<S>(f: (x: T) => S): Transaction<S, Context> {
    return new Transaction(ctx => this.run(ctx).then(x => f(x)))
  }
}
