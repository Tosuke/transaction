import { Transaction } from './transaction'
import { IntoTransaction, intoTransaction, isIntoTransaction } from './intoTransaction'

export function call<T, Context>(tx: IntoTransaction<T, Context>): IntoTransaction<T, Context> {
  return {
    [intoTransaction]: tx[intoTransaction].bind(tx)
  }
}

export function co<T, Context>(generator: () => AsyncIterable<IntoTransaction<any, Context>>): Transaction<T, Context> {
  return new Transaction<any, Context>(ctx => {
    const iter = generator()[Symbol.asyncIterator]()
    async function onFulfilled(res?: any): Promise<any> {
      return await next(await iter.next(res))
    }

    async function onRejected(err: any): Promise<any> {
      if (iter.throw != null) {
        return await next(await iter.throw(err))
      } else {
        throw err
      }
    }

    async function next(res: IteratorResult<IntoTransaction<unknown, Context>>): Promise<any> {
      if (res.done) return res.value
      const tx = res.value
      if (isIntoTransaction(tx)) {
        return await Transaction.from(tx).run(ctx).then(onFulfilled, onRejected)
      } else {
        throw new TypeError(`You may only yield IntoTransaction, but the following object was passed: ${tx}`)
      }
    }

    return onFulfilled()
  })
}
