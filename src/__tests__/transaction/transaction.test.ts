import { Transaction, TransactionExucutor, withContext, of, throwError, join} from '../../index'

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

  function testTx<T>(tx: Transaction<T, Context>): Promise<T> {
    return tx.exec(executor)
  }

  describe('combinator', () => {
    describe('.map()', () => {
      it(`maps this Transactions's result to a different type.`, async () => {
        const tx = of(100).map(x => x + 1) as Transaction<number, {}>
        await expect(testTx(tx)).resolves.toBe(101)
      })
    })
    describe('.chain()', () => {
      it('executes another Transaction after this one has resolved successfully.', async () => {
        const tx = of(100).chain(
          x =>
            withContext<Context>()(async ctx => {
              // do computation using the context
              ctx.mock()
              await delay(x)
              return x + 1
            }),
        )
        await expect(testTx(tx)).resolves.toBe(101)
        expect(txMock).toBeCalled()
      })
    })
    describe('.catch()', () => {
      it('executes another Transaction if this one rejects with a error.', async () => {
        const tx = throwError(new Error('Error!!!')).catch(err => of(err.message))
        await expect(testTx(tx)).resolves.toBe('Error!!!')
      })
    })
    describe('.finally()', () => {
      it('executes another Transaction after this one has resolved, regardless of the result.', async () => {
        const tx = of(100).finally<Context>(() => new Transaction(async ctx => ctx.mock()))
        await expect(testTx(tx)).resolves.toBe(100)
        expect(txMock).toBeCalled()
      })
    })
  })

  describe('Transaction is (almost) a Functor', () => {
    describe('identify', () => {
      async function identify<T>(value: T): Promise<void> {
        const tx1 = of(value)
        const tx2 = tx1.map(x => x)

        await expect(tx1.exec(executor)).resolves.toEqual(value)
        await expect(tx1.exec(executor)).resolves.toEqual(value)
      }
      test('with number', () => {
        return identify(100)
      })
      test('with Transaction', () => {
        return identify(of(100))
      })
      /* test('with Promise', () => {
        return identify(Promise.resolve(100))
      }) */
    })
    describe('associative', () => {
      async function associative<S, T, U>(
        value: S,
        f: (x: S) => T,
        g: (x: T) => U,
        asserteq: (expected: U, actual: U) => Promise<void>,
      ): Promise<void> {
        const tx0 = of(value)
        const tx1 = tx0.map(f).map(g)
        const tx2 = tx0.map(x => g(f(x)))

        const z = g(f(value))
        await asserteq(await tx1.exec(executor), z)
        await asserteq(await tx2.exec(executor), z)
      }

      test('with number', () => {
        return associative(
          100,
          x => x.toString(),
          x => ({ str: x }),
          async (e, a) => {
            expect(e).toEqual(a)
          },
        )
      })
      test('with Transaction', () => {
        return associative(
          of(100),
          x => x.map(y => y.toString()),
          x => x.map(y => ({ str: y })),
          async (e, a) => {
            await expect(testTx(e)).resolves.toEqual(await testTx(a))
          },
        )
      })
    })
  })

  describe('Transaction is (almost) a Monad', () => {
    describe('leftIdentity', () => {
      test('with number', async () => {
        const value = Math.random()
        const f = (x: number) => of(x + 100)

        const tx1 = of(value).chain(f)
        const tx2 = f(value)

        // tx1 === tx2
        const tx = join(tx1, tx2).map(([x, y]) => x === y)
        await expect(testTx(tx)).resolves.toBeTruthy()
      })
    })
    describe('rightIdentity', () => {
      test('with number', async () => {
        const value = Math.random()

        const tx1 = of(value)
        const tx2 = tx1.chain(x => of(x))

        // tx1 === tx2
        const tx = join(tx1, tx2).map(([x, y]) => x === y)
        await expect(testTx(tx)).resolves.toBeTruthy()
      })
    })
    describe('associativeBind', () => {
      test('with number', async () => {
        const value = Math.random()
        const f = (x: number) => of(x.toString())
        const g = (x: string) => of({ str: x })

        const tx0 = of(value)

        const tx1 = tx0.chain(f).chain(g)
        const tx2 = tx0.chain(x => f(x).chain(g))

        // tx1 === tx2
        const tx = join(tx1, tx2).map(([x, y]) => x.str === y.str)
        await expect(testTx(tx)).resolves.toBeTruthy()
      })
    })
  })
})
