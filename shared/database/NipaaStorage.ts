/**
 * Firebase storage utilities.
 */
export default class NipaaStorage {
  static REPLAYS_FOLDER = "replays";

  /**
   *
   * @param id The replay id
   * @returns the path for the replay on nipaa storage.
   */
  static pathForReplay(id: number) {
    return `${this.REPLAYS_FOLDER}/${id}.odr`;
  }
}
