import EnvironmentConstants from "../constants/EnvironmentConstants";
import { LimitedCapacityCollection } from "./LimitedCapacityCollection";

/**
 * A collection map that caches it's result during the max edge function time to answer request (10 seconds)
 */
export default class EdgeFunctionCache<K, V> extends LimitedCapacityCollection<
  K,
  V
> {
  constructor(capacity: number) {
    super(
      capacity,
      EnvironmentConstants.EDGE_FUNCTION_LIMIT_RESPONSE_TIME,
      EnvironmentConstants.EDGE_FUNCTION_LIMIT_RESPONSE_TIME
    );
  }
}
