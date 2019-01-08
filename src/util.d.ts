type Head<TS extends any[]> = TS[0]
type Tail<TS extends any[]> = ((...x: TS) => void) extends ((x: any, ...xs: infer XS) => void) ? XS : never

export type Subtype<TS extends any[]> = {
  0: never,
  1: Head<TS>,
  2: Head<TS> & Subtype<Tail<TS>>
}[TS extends [] ? 0 : TS extends [any] ? 1 : 2]
