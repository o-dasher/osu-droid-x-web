enum SubmissionStatus {
  /**
   * Used when a submission fails.
   */
  FAILED = 0,

  /**
   * Used when a score is submitted on the servers,
   *  but not the current best play on that map for the user who made that score.
   */
  SUBMITTED = 1,

  /**
   * Used when a play is submitted successfully, and is the best play from that user.
   */
  BEST = 2,

  /**
   * Used when a play is submitted successfully, and is the best play from that user.
   *  although it should not reward any pp.
   */
  APPROVED = 3,
}

export class SubmissionStatusUtils {
  static USER_BEST_STATUS = [SubmissionStatus.BEST, SubmissionStatus.APPROVED];

  static isUserBest(submission: SubmissionStatus) {
    return this.USER_BEST_STATUS.includes(submission);
  }
}

export default SubmissionStatus;
