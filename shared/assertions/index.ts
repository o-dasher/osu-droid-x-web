import assert from "assert";

export function assertDefined<T>(object: T): asserts object is NonNullable<T> {
  assert(object !== null && object !== undefined);
}
