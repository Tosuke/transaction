import { Transaction, TransactionExucutor } from '../index'

function delay(ms: number): Promise<void> {
  return new Promise(r => {
    setTimeout(r, ms)
  })
}

describe('Transaction', () => {
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

  describe('constructor', () => {
    describe('constructor', () => {
      it('creates a Transaction from a provided function.', async () => {
        const tx = new Transaction(async () => {
          await delay(100)
          return 100
        })
        await expect(tx.exec(executor)).resolves.toBe(100)
      })
    })
    describe('.of()', () => {
      it('creates a Transaction which resolves with a provided value.', async () => {
        const tx = Transaction.of(100)
        await expect(tx.exec(executor)).resolves.toBe(100)
      })
    })
    describe('.throw()', () => {
      it('creates a Transaction which rejects with a provided value.', async () => {
        const tx = Transaction.throw(new Error('Error!!!'))
        await expect(tx.exec(executor)).rejects.toEqual(new Error('Error!!!'))
      })
    })
    describe('.from()', () => {
      it('creates a Transaction from a IntoTransaction.', async () => {
        const tx = Transaction.from(Promise.resolve(100))
        await expect(tx.exec(executor)).resolves.toBe(100)
      })
    })
    describe('.all()', () => {
      it('creates a new Transaction which joins the results of provided Transactions.', async () => {
        const tx1 = Transaction.of(100)
        const tx2 = Transaction.of('hogepiyo').finally(() => delay(100))
        const promise = Promise.resolve(null)
        const tx = Transaction.all(tx1, tx2, promise)
        await expect(tx.exec(executor)).resolves.toEqual([100, 'hogepiyo', null])
      })
      test('The created Transaction should reject when one of provided Transactions rejects.', async () => {
        const tx1 = Transaction.of(100)
        const tx2 = Transaction.throw(new Error('Error!!!')).finally(() => delay(100))
        const tx = Transaction.all(tx1, tx2)
        await expect(tx.exec(executor)).rejects.toEqual(new Error('Error!!!'))
      })
    })
    describe('.race()', () => {
      it('creates a new Transaction which selects over provided Transactions.', async () => {
        const tx1 = Transaction.of(100)
        const tx2 = Transaction.of('hogepiyo').finally(() => delay(100))
        const tx = Transaction.race(tx1, tx2)
        await expect(tx.exec(executor)).resolves.toBe(100)
      })
      test('The created Transaction should success.', async () => {
        const tx1 = Transaction.of(100)
        const tx2 = Transaction.throw(new Error('Error!!!')).finally(() => delay(100))
        const tx = Transaction.race(tx1, tx2)
        await expect(tx.exec(executor)).resolves.toBe(100)
      })
      test('The created Transaction should fail.', async () => {
        const tx1 = Transaction.throw(new Error('Error!!!'))
        const tx2 = Transaction.of('hogepiyo').finally(() => delay(100))
        const tx = Transaction.race(tx1, tx2)
        await expect(tx.exec(executor)).rejects.toEqual(new Error('Error!!!'))
      })
    })
  })

  describe('combinator', () => {
    describe('.map()', () => {
      it(`maps this Transactions's result to a different type.`, async () => {
        const tx = Transaction.of(100).map(x => x + 1)
        await expect(tx.exec(executor)).resolves.toBe(101)
      })
    })
    describe('.andThen() & .chain()', () => {
      it('executes another Transaction after this one has resolved successfully.', async () => {
        const tx = Transaction.of(100).chain(
          x =>
            new Transaction<number, Context>(async ctx => {
              // do computation using the context
              ctx.mock()
              await delay(x)
              return x + 1
            }),
        )
        await expect(tx.exec(executor)).resolves.toBe(101)
        expect(txMock).toBeCalled()
      })
    })
    describe('.catch()', () => {
      it('executes another Transaction if this one rejects with a error.', async () => {
        const tx = Transaction.throw<string>(new Error('Error!!!')).catch(err => Transaction.of(err.message))
        await expect(tx.exec(executor)).resolves.toBe('Error!!!')
      })
    })
    describe('.finally()', () => {
      it('executes another Transaction after this one has resolved, regardless of the result.', async () => {
        const tx = Transaction.of(100).finally<Context>(() => new Transaction(async ctx => ctx.mock()))
        await expect(tx.exec(executor)).resolves.toBe(100)
        expect(txMock).toBeCalled()
      })
    })
  })

  describe('Transaction is (almost) a Functor', () => {
    describe('identify', () => {
      test('with number', async () => {
        const value = Math.random()
        const tx1 = Transaction.of(value)
        const tx2 = tx1.map(x => x)
        // tx1 === tx2
        const tx = Transaction.all(tx1, tx2).map(([x, y]) => x === y)
        await expect(tx.exec(executor)).resolves.toBeTruthy()
      })
    })
    describe('associative', () => {
      test('with number', async () => {
        const value = Math.random()
        const f: (x: number) => string = x => x.toString()
        const g: (x: string) => { str: string } = x => ({ str: x })
        
        const tx0 = Transaction.of(value)
        const tx1 = tx0.map(f).map(g)
        const tx2 = tx0.map(x => g(f(x)))

        // tx1 === tx2
        const tx = Transaction.all(tx1, tx2).map(([x, y]) => x.str === y.str)
        await expect(tx.exec(executor)).resolves.toBeTruthy()
      })
    })
  })

  describe('Transaction is (almost) a Monad', () => {
    describe('leftIdentity', () => {
      test('with number', async () => {
        const value = Math.random()
        const f = (x: number) => Transaction.of(x + 100)

        const tx1 = Transaction.of(value).chain(f)
        const tx2 = f(value)

        // tx1 === tx2
        const tx = Transaction.all(tx1, tx2).map(([x, y]) => x === y)
        await expect(tx.exec(executor)).resolves.toBeTruthy()
      })
    })
    describe('rightIdentity', () => {
      test('with number', async () => {
        const value = Math.random()

        const tx1 = Transaction.of(value)
        const tx2 = tx1.chain(x => Transaction.of(x))

        // tx1 === tx2
        const tx = Transaction.all(tx1, tx2).map(([x, y]) => x === y)
        await expect(tx.exec(executor)).resolves.toBeTruthy()
      })
    })
    describe('associativeBind', () => {
      test('with number', async () => {
        const value = Math.random()
        const f = (x: number) => Transaction.of(x.toString())
        const g = (x: string) => Transaction.of({ str: x })

        const tx0 = Transaction.of(value)

        const tx1 = tx0.chain(f).chain(g)
        const tx2 = tx0.chain(x => f(x).chain(g))

        // tx1 === tx2
        const tx = Transaction.all(tx1, tx2).map(([x, y]) => x.str === y.str)
        await expect(tx.exec(executor)).resolves.toBeTruthy()
      })
    })
  })
})
