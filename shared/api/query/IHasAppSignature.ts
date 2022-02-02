/**
 * Represents a object which may include an app signature for validation reasons.
 */
export default interface IHasAppSignature {
  /**
   * The app signature.
   */
  sign: string;
}
