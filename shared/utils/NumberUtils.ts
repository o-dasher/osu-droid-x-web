export default class NumberUtils {
  /**
   * Verifies if a value of number type is indeed a number (not NaN).
   * @param number the number to verify.
   * @returns wether the value is indeed a number.
   */
  static isNumber(number: number) {
    return !isNaN(number);
  }
}
