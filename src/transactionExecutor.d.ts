import { Transaction } from './transaction'
export type TransactionExecutor<Context> = <T>(transaction: Transaction<T, Context>) => Promise<T>
