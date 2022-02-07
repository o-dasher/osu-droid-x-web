/**
 * Firebase storage utilities.
 */
export default class NipaaStorage {
  static ODRFilePathFromID(id: number) {
    return `replays/${id}.odr`;
  }
}
