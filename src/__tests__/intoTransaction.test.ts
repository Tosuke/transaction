import { TransactionExucutor, of, from } from '../index'

describe('IntoTransaction', () => {
  let executor: TransactionExucutor<{}>
  beforeAll(() => {
    executor = tx => tx.run({})
  })

  test('Transaction is IntoTransaction', async () => {
    const it = of(100)
    const tx = from(it)
    await expect(tx.exec(executor)).resolves.toBe(100)
  })
  test('Promise is IntoTransaction', async () => {
    const it = Promise.resolve(100)
    const tx = from(it)
    await expect(tx.exec(executor)).resolves.toBe(100)
  })
})
