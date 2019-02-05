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

  exec(executor: TransactionExecutor<Context>): Promise<T> {
    return executor(this)
  }

  [intoTransaction](): Transaction<T, Context> {
    return this
  }

  chain<U, ContextU>(onComplete: (x: T) => IntoTransaction<U, ContextU>): Transaction<U, Context & ContextU> {
    return new Transaction(ctx => this.run(ctx).then(x => from(onComplete(x)).run(ctx)))
  }

  catch<Context2>(onRejected: (err: any) => IntoTransaction<T, Context2>): Transaction<T, Context & Context2> {
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

  map<S>(f: (x: T) => S): Transaction<S, Context> {
    return new Transaction(ctx => this.run(ctx).then(x => f(x)))
  }
}
