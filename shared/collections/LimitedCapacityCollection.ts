/**
 * @see https://github.com/Rian8337/Alice/blob/master/src/utils/LimitedCapacityCollection.ts
 */

import { minutesToSeconds, secondsToMilliseconds } from "date-fns";
import { assertDefined } from "../assertions";

/**
 * A collection with limited capacity.
 */
export class LimitedCapacityCollection<K, V> extends Map<K, V> {
  /**
   * The capacity of this collection.
   */
  protected readonly capacity: number;

  /**
   * The epoch time at which a cache data is added, in milliseconds.
   */
  readonly #addedTime = new Map<K, number>();

  /**
   * The interval at which this limited collection will be sweeped, in seconds.
   */
  readonly #sweepInterval: number;

  /**
   * The lifetime of each cache data in this limited collection.
   */
  readonly #lifetime: number;

  #interval?: NodeJS.Timeout;

  /**
   * @param capacity The capacity of the collection.
   * @param lifetime The lifetime of each cache data in the collection, in seconds.
   */
  constructor(
    capacity: number,
    lifetime: number,
    sweepInterval = minutesToSeconds(10)
  ) {
    super();

    this.capacity = capacity;
    this.#lifetime = lifetime;
    this.#sweepInterval = sweepInterval;

    if (capacity <= 0) {
      throw new Error(`Invalid limited collection capacity: ${capacity}`);
    }

    if (lifetime <= 0) {
      throw new Error(`Invalid limited collection lifetime: ${lifetime}`);
    }
  }

  /**
   * Starts an interval to periodically sweep cache data that
   * were unused for the specified duration.
   */
  #startInterval(): void {
    if (this.#interval) {
      return;
    }

    this.#interval = setInterval(() => {
      assertDefined(this.#interval);

      const executionTime: number = Date.now();

      this.#addedTime.forEach((value, key) => {
        if (executionTime - value > secondsToMilliseconds(this.#lifetime)) {
          this.#addedTime.delete(key);
          this.delete(key);
        }
      });

      if (this.size === 0) {
        clearInterval(this.#interval);
        this.#interval = undefined;
      }
    }, secondsToMilliseconds(this.#sweepInterval));
  }

  /**
   * Adds or updates an element with a specified key and a value to the collection.
   *
   * If the capacity overfills, the oldest added/updated element will be removed.
   *
   * @param key The key of the element to add.
   * @param value The value of the element to add.
   * @returns This `LimitedCapacityCollection` object.
   */
  override set(key: K, value: V): this {
    while (this.size >= this.capacity) {
      const firstKey = [...this.keys()][0];
      assertDefined(firstKey);
      this.#addedTime.delete(firstKey);
      this.delete(firstKey);
    }

    // Reenter to set lastKey() to this key.
    this.delete(key);

    super.set(key, value);

    this.#startInterval();

    this.#addedTime.set(key, Date.now());

    return this;
  }
}
