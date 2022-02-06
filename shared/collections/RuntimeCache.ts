import { LimitedCapacityCollection } from "./LimitedCapacityCollection";

/**
 * A collection map that caches it's result during the max edge function runtime time (10 seconds)
 */
export default class RuntimeCache<K, V> extends LimitedCapacityCollection<
  K,
  V
> {
  public constructor(capacity: number) {
    super(capacity, 10, 10);
  }
}
