import { Transaction } from './transaction'
export type TransactionExucutor<Context> = <T>(transaction: Transaction<T, Context>) => Promise<T>