import IHasDeviceID from "../../api/query/IHasDeviceID";
import OsuDroidUser from "../../database/entities/OsuDroidUser";
import IHasID from "../../interfaces/IHasID";

export enum SubmissionStatus {
  FAILED = 0,
  SUBMITTED = 1,
  BEST = 2,
}

export default interface IOsuDroidScore extends IHasID, IHasDeviceID {
  mapHash: string;

  player: OsuDroidUser;

  pp: number;

  score: number;

  maxCombo: number;

  mods: number;

  accuracy: number;

  h300: number;

  h100: number;

  h50: number;

  hMiss: number;

  hGeki: number;

  hKatsu: number;

  grade: string;

  rank: number;

  status: SubmissionStatus;

  previousSubmittedScores: IOsuDroidScore[];
}
