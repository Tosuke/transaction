import { Transaction } from '../index'

function delay(ms: number): Promise<void> {
  return new Promise(r => {
    setTimeout(r, ms)
  })
}

describe('Transaction constructor', () => {
  describe('constructor', () => {
    it('creates a Transaction from a provided function.', async () => {
      const tx = new Transaction<number>(async () => {
        await delay(100)
        return 100
      })
      await expect(tx.run({})).resolves.toBe(100)
    })
  })
  describe('.of()', () => {
    it('creates a Transaction which resolves with a provided value.', async () => {
      const tx = Transaction.of(100)
      await expect(tx.run({})).resolves.toBe(100)
    })
  })
  describe('.throw()', () => {
    it('creates a Transaction which rejects with a provided value.', async () => {
      const tx = Transaction.throw(new Error('Error!!!'))
      await expect(tx.run({})).rejects.toEqual(new Error('Error!!!'))
    })
  })
  describe('.from()', () => {
    it('creates a Transaction from a IntoTransaction.', async () => {
      const tx = Transaction.from(Promise.resolve(100))
      await expect(tx.run({})).resolves.toBe(100)
    })
  })
  describe('.all()', () => {
    it('creates a new Transaction which joins the results of provided Transactions.', async () => {
      const tx1 = Transaction.of(100)
      const tx2 = Transaction.of('hogepiyo').finally(() => delay(100))
      const promise = Promise.resolve(null)
      const tx = Transaction.all(tx1, tx2, promise)
      await expect(tx.run({})).resolves.toEqual([100, 'hogepiyo', null])
    })
    test('The created Transaction should reject when one of provided Transactions rejects.', async () => {
      const tx1 = Transaction.of(100)
      const tx2 = Transaction.throw(new Error('Error!!!')).finally(() => delay(100))
      const tx = Transaction.all(tx1, tx2)
      await expect(tx.run({})).rejects.toEqual(new Error('Error!!!'))
    })
  })
  describe('.race()', () => {
    it('creates a new Transaction which selects over provided Transactions.', async () => {
      const tx1 = Transaction.of(100)
      const tx2 = Transaction.of('hogepiyo').finally(() => delay(100))
      const tx = Transaction.race(tx1, tx2)
      await expect(tx.run({})).resolves.toBe(100)
    })
    test('The created Transaction should success.', async () => {
      const tx1 = Transaction.of(100)
      const tx2 = Transaction.throw(new Error('Error!!!')).finally(() => delay(100))
      const tx = Transaction.race(tx1, tx2)
      await expect(tx.run({})).resolves.toBe(100)
    })
    test('The created Transaction should fail.', async () => {
      const tx1 = Transaction.throw(new Error('Error!!!'))
      const tx2 = Transaction.of('hogepiyo').finally(() => delay(100))
      const tx = Transaction.race(tx1, tx2)
      await expect(tx.run({})).rejects.toEqual(new Error('Error!!!'))
    })
  })
})

describe('Transaction combinator', () => {
  describe('.map()', () => {
    it(`maps this Transactions's result to a different type.`, async () => {
      const tx = Transaction.of(100).map(x => x + 1)
      await expect(tx.run({})).resolves.toBe(101)
    })
  })
  describe('.then()', () => {
    it('executes another Transaction after this one has resolved successfully.', async () => {
      const tx = Transaction.of(100).then(
        x =>
          new Transaction(async ctx => {
            // do computation using the context
            await delay(x)
            return x + 1
          }),
      )
      await expect(tx.run({})).resolves.toBe(101)
    })
  })
  describe('.catch()', () => {
    it('executes another Transaction if this one rejects with a error.', async () => {
      const tx = Transaction.throw<string>(new Error('Error!!!')).catch(err => Transaction.of(err.message))
      await expect(tx.run({})).resolves.toBe('Error!!!')
    })
  })
  describe('.finally()', () => {
    it('executes another Transaction after this one has resolved, regardless of the result.', async () => {
      const mock = jest.fn()
      const tx = Transaction.of(100).finally(async () => {
        mock()
      })
      await expect(tx.run({})).resolves.toBe(100)
      expect(mock).toBeCalled()
    })
  })
})
