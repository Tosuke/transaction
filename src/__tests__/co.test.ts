import { Transaction, TransactionExucutor, co } from '../index'

describe('co', () => {
  let executor: TransactionExucutor<{}>
  beforeAll(() => {
    executor = tx => tx.run({})
  })

  it('combines two Transactions', async () => {
    const tx = co<number>()(async function*() {
      const v1 = yield Transaction.of(50)
      const v2 = yield Transaction.of(2)
      return Transaction.of(v1 * v2)
    })
    await expect(tx.exec(executor)).resolves.toBe(100)
  })

  test('error', async () => {
    const tx = co<never>()(async function*() {
      yield Transaction.throw(new Error('Error!!!'))
    })
    await expect(tx.exec(executor)).rejects.toEqual(new Error('Error!!!'))
  })

  test('throw', async () => {
    const tx = co<never>()(async function*() {
      throw new Error('Error!!!')
      yield Transaction.of(100)
    })
    await expect(tx.exec(executor)).rejects.toEqual(new Error('Error!!!'))
  })

  test('try-catch', async () => {
    const tx = co<number>()(async function*() {
      let value
      try {
        value = yield Transaction.of(100)
        throw new Error()
      } catch {}
      return Transaction.of(value)
    })
    await expect(tx.exec(executor)).resolves.toBe(100)
  })
})
