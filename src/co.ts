import { Transaction, from, fromLoop } from './transaction'
import { loopBreak, loopContinue } from './loop'
import { IntoTransaction } from './intoTransaction'

interface State<C> {
  value: unknown
  error: Error | null
  iter: AsyncGenerator<IntoTransaction<unknown, C>, IntoTransaction<unknown, C> | unknown, unknown>
}

type AsyncGen<T, C, Y> = () => AsyncGenerator<IntoTransaction<Y, C>, IntoTransaction<T, C> | T, Y>

export function co<T>(): <Context, Y = unknown>(generator: AsyncGen<T, Context, Y>) => Transaction<T, Context>
export function co<T, Context, Y = unknown>(generator: AsyncGen<T, Context, Y>): Transaction<T, Context>
export function co<T, Context, Y = unknown>(generator?: AsyncGen<T, Context, Y>): unknown {
  if (generator === undefined) {
    return coImpl
  } else {
    return coImpl(generator)
  }
}

function coImpl<T, Context, Y>(generator: AsyncGen<T, Context, Y>): Transaction<T, Context> {
  const initial: State<Context> = {
    value: undefined,
    error: null,
    iter: generator()[Symbol.asyncIterator](),
  }
  return fromLoop(
    initial,
    ({ iter, value, error }) =>
      new Transaction(async ctx => {
        let res: IteratorResult<IntoTransaction<unknown, Context>>
        if (error) {
          res = await iter.throw!(error)
        } else {
          res = await iter.next(value)
        }

        try {
          const newValue = await from(res.value).run(ctx)
          if (res.done) {
            return loopBreak(newValue as T)
          }
          return loopContinue({
            value: newValue,
            error: null,
            iter,
          })
        } catch (err) {
          return loopContinue({
            value: undefined,
            error: err,
            iter,
          })
        }
      }),
  )
}
