import IHasID from "../../interfaces/IHasID";

export default interface IOsuDroidUser extends IHasID {
  /**
   * User's username.
   */
  username: string;

  /**
   * User's rank.
   */
  rank: number;

  /**
   * User's accuracy.
   */
  accuracy: number;

  /**
   * User's total playcount.
   */
  playcount: number;

  /**
   * User's total ranked score.
   */
  rankedScore: number;

  /**
   * User's overall total score.
   */
  totalScore: number;

  /**
   * User's total pp
   */
  pp: number;
}
