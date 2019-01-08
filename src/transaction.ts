import { intoTransaction, IntoTransaction, isIntoTransaction } from './intoTransaction'
import { Subtype } from './util'

type UnwrapIntoTransaction<TS extends IntoTransaction<any, any>[]> = {
  [K in keyof TS]: TS[K] extends IntoTransaction<infer T, any> ? T : never
}
type ExtractContext<TS extends IntoTransaction<any, any>[]> = {
  [K in keyof TS]: TS[K] extends IntoTransaction<any, infer C> ? C : never
}
type InferAllContext<TS extends IntoTransaction<any, any>[]> = Subtype<ExtractContext<TS>>

export abstract class Transaction<T, Context = unknown> implements IntoTransaction<T, Context> {
  abstract run(context: Context): Promise<T>
  [intoTransaction]() {
    return this
  }

  static of<T, Context = unknown>(value: T): Transaction<T, Context> {
    return new TxPromise<T, Context>(Promise.resolve(value))
  }

  static throws<T = never, Context = unknown>(err: any): Transaction<T, Context> {
    return new TxPromise<T, Context>(Promise.reject(err))
  }

  static from<T, Context>(from: IntoTransaction<T, Context>): Transaction<T, Context> {
    if (!isIntoTransaction(from)) {
      throw new TypeError("'from' is not IntoTransaction")
    }
    return from[intoTransaction]()
  }

  static all<Transactions extends IntoTransaction<any, any>[]>(
    ...transactions: Transactions
  ): Transaction<UnwrapIntoTransaction<Transactions>, InferAllContext<Transactions>> {
    return new TxAll<UnwrapIntoTransaction<Transactions>, InferAllContext<Transactions>>(transactions)
  }

  then<S, ContextS>(onComplete: (x: T) => IntoTransaction<S, ContextS>): Transaction<S, Context & ContextS> {
    return new TxThen<T, S, Context, ContextS>(this, onComplete)
  }

  catch<Context_>(onRejected: (err: any) => IntoTransaction<T, Context_>): Transaction<T, Context & Context_> {
    return new TxCatch<T, Context, Context_>(this, onRejected)
  }

  finally<Context_>(onFinally: () => IntoTransaction<void, Context_>): Transaction<T, Context & Context_> {
    return new TxFinally<T, Context, Context_>(this, onFinally)
  }

  map<S>(f: (x: T) => S): Transaction<S, Context> {
    return new TxMap<T, S, Context>(this, f)
  }
}

export class TxPromise<T, Ctx = unknown> extends Transaction<T, Ctx> {
  private _promise: Promise<T>

  constructor(promise: Promise<T>) {
    super()
    this._promise = promise
  }

  run(ctx: Ctx): Promise<T> {
    return this._promise
  }
}

class TxAll<TS extends any[], Ctx> extends Transaction<TS, Ctx> {
  private _transactions: IntoTransaction<any, Ctx>[]

  constructor(transactions: IntoTransaction<any, Ctx>[]) {
    super()
    this._transactions = transactions
  }

  run(ctx: Ctx): Promise<TS> {
    return Promise.all(this._transactions.map(tx => tx[intoTransaction]().run(ctx))) as Promise<TS>
  }
}

class TxThen<A, B, CtxA, CtxB> extends Transaction<B, CtxA & CtxB> {
  private _prev: Transaction<A, CtxA>
  private _func: ((x: A) => IntoTransaction<B, CtxB>)

  constructor(prev: Transaction<A, CtxA>, func: ((x: A) => IntoTransaction<B, CtxB>)) {
    super()
    this._prev = prev
    this._func = func
  }

  run(ctx: CtxA & CtxB): Promise<B> {
    return this._prev.run(ctx).then(x =>
      this._func(x)
        [intoTransaction]()
        .run(ctx),
    )
  }
}

class TxCatch<T, CtxA, CtxB> extends Transaction<T, CtxA & CtxB> {
  private _prev: Transaction<T, CtxA>
  private _func: (err: any) => IntoTransaction<T, CtxB>

  constructor(prev: Transaction<T, CtxA>, func: (err: any) => IntoTransaction<T, CtxB>) {
    super()
    this._prev = prev
    this._func = func
  }

  run(ctx: CtxA & CtxB): Promise<T> {
    return this._prev.run(ctx).catch(err =>
      this._func(err)
        [intoTransaction]()
        .run(ctx),
    )
  }
}

class TxFinally<T, CtxA, CtxB> extends Transaction<T, CtxA & CtxB> {
  private _prev: Transaction<T, CtxA>
  private _func: () => IntoTransaction<void, CtxB>

  constructor(prev: Transaction<T, CtxA>, func: () => IntoTransaction<void, CtxB>) {
    super()
    this._prev = prev
    this._func = func
  }

  run(ctx: CtxA & CtxB): Promise<T> {
    const runFinally = () =>
      this._func()
        [intoTransaction]()
        .run(ctx)
    const promise = this._prev.run(ctx)
    if (promise.finally != null && typeof promise.finally === 'function') {
      return promise.finally(runFinally)
    } else {
      return promise.then(
        a => {
          runFinally()
          return a
        },
        e => {
          runFinally()
          return Promise.reject(e)
        },
      )
    }
  }
}

class TxMap<A, B, Ctx> extends Transaction<B, Ctx> {
  private _prev: Transaction<A, Ctx>
  private _func: (x: A) => B

  constructor(prev: Transaction<A, Ctx>, func: (x: A) => B) {
    super()
    this._prev = prev
    this._func = func
  }

  run(ctx: Ctx): Promise<B> {
    return this._prev.run(ctx).then(x => this._func(x))
  }
}