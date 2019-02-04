import { Transaction, TransactionExucutor, co } from '../index'

describe('co', () => {
  let executor: TransactionExucutor<{}>
  beforeAll(() => {
    executor = tx => tx.run({})
  })

  it('combines two Transactions', async () => {
    const tx = co<number, unknown>(async function*() {
      const v1 = yield Transaction.of(50)
      const v2 = yield Transaction.of(2)
      return Transaction.of(v1 * v2)
    })
    await expect(tx.exec(executor)).resolves.toBe(100)
  })

  it('creates a Transaction which throws when a internal Transaction throws', async () => {
    const tx = co<never, unknown>(async function*() {
      yield Transaction.throw(new Error('Error!!!'))
    })
    await expect(tx.exec(executor)).rejects.toEqual(new Error('Error!!!'))
  })
})