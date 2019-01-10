import { Transaction, TransactionExucutor, co } from '../index'

describe('co', () => {
  let executor: TransactionExucutor<{}>
  beforeAll(() => {
    executor = tx => tx.run({})
  })

  it('combines Transactions', async () => {
    const tx = co<number, unknown>(async function*(): AsyncIterable<any> {
      const v0 = await Promise.resolve(2)
      const v1 = yield Transaction.of(25)

      let v2: number = 0
      try {
        yield Transaction.throw(new Error())
      } catch {
        v2 = 2
      }

      return v0 * v1 * v2
    })
    await expect(tx.exec(executor)).resolves.toBe(100)
  })
})