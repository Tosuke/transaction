import { Transaction, TransactionExucutor } from '../index'

describe('IntoTransaction', () => {
  let executor: TransactionExucutor<{}>
  beforeAll(() => {
    executor = tx => tx.run({})
  })

  test('Transaction is IntoTransaction', async () => {
    const it = Transaction.of(100)
    const tx = Transaction.from(it)
    await expect(tx.exec(executor)).resolves.toBe(100)
  })
  test('Promise is IntoTransaction', async () => {
    const it = Promise.resolve(100)
    const tx = Transaction.from(it)
    await expect(tx.exec(executor)).resolves.toBe(100)
  })
})