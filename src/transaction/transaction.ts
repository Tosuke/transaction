import { intoTransaction } from '../intoTransactionSymbol'
import { IntoTransaction } from '../intoTransaction'
import { TransactionExecutor } from '../transactionExecutor'
import { from } from './creator'

export class Transaction<T, Context = unknown> implements IntoTransaction<T, Context> {
  private _f: (context: Context) => Promise<T>

  constructor(f: (context: Context) => Promise<T>) {
    this._f = f
  }

  run(context: Context): Promise<T> {
    return this._f(context)
  }

  exec<C extends Context>(executor: TransactionExecutor<C>): Promise<T> {
    return executor(this as any)
  }

  [intoTransaction](): Transaction<T, Context> {
    return this
  }

  chain<U, ContextU>(onComplete: (x: T) => IntoTransaction<U, ContextU>): Transaction<U, Context & ContextU> {
    return new Transaction(ctx => this.run(ctx).then(x => from(onComplete(x)).run(ctx)))
  }

  catch<U, ContextU>(onRejected: (err: any) => IntoTransaction<U, ContextU>): Transaction<T | U, Context & ContextU> {
    return new Transaction(ctx => this.run(ctx).catch(e => from(onRejected(e)).run(ctx)))
  }

  finally<Context2>(onFinally: () => IntoTransaction<void, Context2>): Transaction<T, Context & Context2> {
    return new Transaction(async ctx => {
      try {
        return await this.run(ctx)
      } finally {
        await from(onFinally()).run(ctx)
      }
    })
  }

  map<S, C extends Context>(f: (x: T) => S): Transaction<S, C> {
    return new Transaction(ctx => this.run(ctx).then(x => f(x)))
  }
}
