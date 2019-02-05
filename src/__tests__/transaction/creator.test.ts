import {
  Transaction,
  intoTransaction,
  withContext,
  of,
  throwError,
  from,
  fromLoop,
  join,
  select,
  TransactionExucutor,
  loopBreak,
  loopContinue,
} from '../../index'

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

describe('Transaction creators', () => {
  interface Context {
    mock: () => void
  }

  let executor: TransactionExucutor<Context>
  let txMock: () => void

  beforeEach(() => {
    txMock = jest.fn()
    executor = tx => {
      const ctx = {
        mock: txMock,
      }
      return tx.run(ctx)
    }
  })

  function testTx<T>(tx: Transaction<T, Context>): Promise<T> {
    return tx.exec(executor)
  }

  describe('withContext', () => {
    it('creates a Transaction from a provided function.', async () => {
      const tx = withContext<Context>()(async ({ mock }) => {
        await delay(100)
        mock()
        return 100
      })
      await expect(testTx(tx)).resolves.toBe(100)
      expect(txMock).toBeCalled()
    })
  })

  describe('of', () => {
    it('creates a Transaction which resolves with a provided value.', async () => {
      const tx = of(100)
      await expect(testTx(tx)).resolves.toBe(100)
    })
  })

  describe('throwError', () => {
    it('creates a Transaction which rejects with a provided reason.', async () => {
      const tx = throwError('Error!!!')
      await expect(testTx(tx)).rejects.toBe('Error!!!')
    })
  })

  describe('from', () => {
    it('creates a Transaction from a provided IntoTransaction.', async () => {
      const it = {
        [intoTransaction]() {
          return new Transaction<number>(async () => 100)
        },
      }
      const tx = from(it)
      await expect(testTx(tx)).resolves.toBe(100)
    })
  })

  describe('fromLoop', () => {
    it('creates a Transaction from a tail-recursive loop.', async () => {
      const array = [of(1), of(2), of(3), of(4), of(5), of(6), of(7), of(8), of(9), of(10)]
      const tx = fromLoop({ n: 0, iter: array.values() }, ({ n, iter }) => {
        const res = iter.next()
        if (res.done) return of(loopBreak(n))
        return res.value.map(m =>
          loopContinue({
            n: n + m,
            iter,
          }),
        )
      })
      await expect(testTx(tx)).resolves.toBe(55)
    })
  })

  describe('join', () => {
    it('joins provided Transactions into a new Transaction', async () => {
      const tx1 = of(100)
      const tx2 = of('hoge').finally(() => delay(100))
      const tx3 = Promise.resolve(null)
      const tx = join(tx1, tx2, tx3)
      await expect(testTx(tx)).resolves.toEqual([100, 'hoge', null])
    })
    test('When one of transactions rejects, a joined transaction should rejects', async () => {
      const tx1 = of(100)
      const tx2 = throwError('Error!!!')
      const tx = join(tx1, tx2)
      await expect(testTx(tx)).rejects.toEqual('Error!!!')
    })
  })

  describe('select', () => {
    it('creates a new Transaction which will select over provided Transactions.', async () => {
      const tx1 = of(100)
      const tx2 = of('hoge').finally(() => delay(100))
      const tx = select(tx1, tx2)
      await expect(testTx(tx)).resolves.toBe(100)
    })
    test('Although one of transaction rejects after an other transaction resolves, a created Transaction should resolve', async () => {
      const tx1 = of(100)
      const tx2 = throwError('Error!!!').finally(() => delay(100))
      const tx = select(tx1, tx2)
      await expect(testTx(tx)).resolves.toBe(100)
    })
    test('When one of transaction rejects before other transactions resolve, a created Transaction should reject', async () => {
      const tx1 = of(100).finally(() => delay(100))
      const tx2 = throwError('Error!!!')
      const tx = select(tx1, tx2)
      await expect(testTx(tx)).rejects.toBe('Error!!!')
    })
  })
})
