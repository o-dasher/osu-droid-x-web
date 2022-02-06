import { LimitedCapacityCollection } from "./LimitedCapacityCollection";

/**
 * A collection map that caches it's result during the max edge function time to answer request (10 seconds)
 */
export default class EdgeFunctionCache<K, V> extends LimitedCapacityCollection<
  K,
  V
> {
  public constructor(capacity: number) {
    super(capacity, 10, 10);
  }
}
