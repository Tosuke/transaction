import { TransactionExucutor, of, throwError , co } from '../index'

describe('co', () => {
  let executor: TransactionExucutor<{}>
  beforeAll(() => {
    executor = tx => tx.run({})
  })

  it('combines two Transactions', async () => {
    const tx = co<number>()(async function*() {
      const v1 = yield of(50)
      const v2 = yield of(2)
      return of(v1 * v2)
    })
    await expect(tx.exec(executor)).resolves.toBe(100)
  })

  test('error', async () => {
    const tx = co<never>()(async function*() {
      yield throwError(new Error('Error!!!'))
    })
    await expect(tx.exec(executor)).rejects.toEqual(new Error('Error!!!'))
  })

  test('throw', async () => {
    const tx = co<never>()(async function*() {
      throw new Error('Error!!!')
      yield of(100)
    })
    await expect(tx.exec(executor)).rejects.toEqual(new Error('Error!!!'))
  })

  test('try-catch', async () => {
    const tx = co<number>()(async function*() {
      let value
      try {
        value = yield of(100)
        throw new Error()
      } catch {}
      return of(value)
    })
    await expect(tx.exec(executor)).resolves.toBe(100)
  })
})
