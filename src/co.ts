import { Transaction } from './transaction'
import { loopBreak, loopContinue } from './loop'
import { IntoTransaction, isIntoTransaction } from './intoTransaction'

interface State<C> {
  value: unknown
  error: Error | null
  iter: AsyncIterator<IntoTransaction<unknown, C>>
}

type Generator<C> = () => AsyncIterable<IntoTransaction<unknown, C>>

export function co<T>(): <Context>(generator: Generator<Context>) => Transaction<T, Context>
export function co<T, Context>(generator: Generator<Context>): Transaction<T, Context>
export function co<T, Context>(generator?: Generator<Context>): unknown {
  if (generator === undefined) {
    return coImpl
  } else {
    return coImpl(generator)
  }
}


function coImpl<T, Context>(
  generator: Generator<Context>,
): Transaction<T, Context> {

  const initial: State<Context> = {
    value: undefined,
    error: null,
    iter: generator()[Symbol.asyncIterator](),
  }
  return Transaction.fromLoop(
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
          const newValue = await Transaction.from(res.value).run(ctx)
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
