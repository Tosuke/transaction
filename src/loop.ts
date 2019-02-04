export type Loop<S, T> = {
  type: 'break',
  value: T
} | {
  type: 'continue',
  value: S
}

export function loopBreak<T>(value: T): Loop<never, T> {
  return {
    type: 'break',
    value
  }
}

export function loopContinue<T>(value: T): Loop<T, never> {
  return {
    type: 'continue',
    value
  }
}
