interface IEntityWithStatsMetrics {
  accuracyDroid: number;

  /**
   * The used metric for ranking system;
   */
  metric: number;

  /**
   * Same as {@link metric} except with rounded result.
   */
  roundedMetric: number;
}

export default IEntityWithStatsMetrics;
