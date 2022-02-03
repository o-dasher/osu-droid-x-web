import { MapInfo, rankedStatus } from "@rian8337/osu-base";
import {
  DroidPerformanceCalculator,
  DroidStarRating,
} from "@rian8337/osu-difficulty-calculator";
import _ from "lodash";
import {
  BaseEntity,
  Column,
  Entity,
  ManyToOne,
  MoreThan,
  PrimaryGeneratedColumn,
} from "typeorm";
import IOsuDroidScore, {
  SubmissionStatus,
} from "../../droid/interfaces/IOsuDroidScore";
import NumberUtils from "../../utils/NumberUtils";
import OsuDroidUser from "./OsuDroidUser";

@Entity()
export default class OsuDroidScore
  extends BaseEntity
  implements IOsuDroidScore
{
  @PrimaryGeneratedColumn("increment")
  id!: number;

  @Column("string")
  mapHash!: string;

  @ManyToOne(() => OsuDroidUser, (u) => u.scores)
  player!: OsuDroidUser;

  @Column("float")
  pp!: number;

  @Column("int")
  score!: number;

  @Column("int")
  maxCombo!: number;

  @Column("int")
  mods!: number;

  @Column("float")
  accuracy!: number;

  @Column("int")
  h300!: number;

  @Column("int")
  h100!: number;

  @Column("int")
  h50!: number;

  @Column("int")
  hMiss!: number;

  @Column("int")
  hGeki!: number;

  @Column("int")
  hKatsu!: number;

  @Column("string")
  grade!: string;

  @Column("int")
  rank!: number;

  @Column("int")
  status!: SubmissionStatus;

  @Column("bool")
  fc!: boolean;

  @Column("string")
  deviceID!: string;

  @ManyToOne(() => OsuDroidScore)
  previousSubmittedScores!: OsuDroidScore[];

  beatmap!: MapInfo;

  public static ABLE_TO_SUBMIT_STATUS = [
    rankedStatus.RANKED,
    rankedStatus.LOVED,
    rankedStatus.APPROVED,
  ];

  public static isSubmittable(map: MapInfo) {
    return this.ABLE_TO_SUBMIT_STATUS.includes(map.approved);
  }

  /**
   *
   * @param data replay data.
   */
  public static async fromSubmission(
    data: string,
    user?: OsuDroidUser
  ): Promise<OsuDroidScore> {
    const dataArray = data.split(" ");

    const username = dataArray[13];

    let score = new OsuDroidScore();

    const fail = () => {
      score.status = SubmissionStatus.FAILED;
    };

    if (!user) {
      user = await OsuDroidUser.findOne({
        where: {
          username,
        },
        select: ["username", "playing"],
      });
      if (!user) {
        fail();
        return score;
      }
    }

    if (user.username !== username) {
      fail();
      return score;
    }

    if (!user.playing) {
      fail();
      return score;
    }

    score.mapHash = user.playing;

    const previousScore = await OsuDroidScore.findOne({
      where: {
        player: user,
        mapHash: score.mapHash,
      },
      relations: ["previousSubmittedScores", "player"],
    });

    if (previousScore) {
      score = previousScore;
    }

    score.player = user;

    const mapInfo = await MapInfo.getInformation({
      hash: score.mapHash,
    });

    if (!mapInfo.title || !mapInfo.map) {
      fail();
      return score;
    }

    score.beatmap = mapInfo;

    if (!this.isSubmittable(mapInfo)) {
      fail();
      return score;
    }

    const spliceDataToInteger = (from: number, to: number) => {
      const integerData = dataArray.splice(from, to).map((v) => parseInt(v));
      if (!integerData.every((v) => NumberUtils.isNumber(v))) {
        console.log("Invalid data, passed for score.");
        return;
      }
      return integerData;
    };

    const firstIntegerData = spliceDataToInteger(1, 3);
    if (!firstIntegerData) {
      fail();
      return score;
    }

    score.mods = firstIntegerData[0];
    score.score = firstIntegerData[1];
    score.maxCombo = firstIntegerData[2];

    score.grade = data[3];

    const secondIntegerData = spliceDataToInteger(4, 10);
    if (!secondIntegerData) {
      fail();
      return score;
    }

    score.hGeki = secondIntegerData[0];
    score.h300 = secondIntegerData[1];
    score.hKatsu = secondIntegerData[2];
    score.h100 = secondIntegerData[3];
    score.h50 = secondIntegerData[4];
    score.hMiss = secondIntegerData[5];

    const rawAccuracy = parseFloat(data[10]);
    if (!NumberUtils.isNumber(rawAccuracy)) {
      fail();
      return score;
    }

    score.accuracy = rawAccuracy / 1000;

    score.deviceID = data[11];

    score.fc = score.maxCombo === mapInfo.map.maxCombo;

    const stars = new DroidStarRating().calculate({
      map: mapInfo.map,
    });

    const performance = new DroidPerformanceCalculator().calculate({
      stars,
    });

    score.pp = performance.total;

    await score.calculatePlacement();

    await score.calculateStatus(previousScore);

    return score;
  }

  public static getBestScoreFromArray(scores: OsuDroidScore[]) {
    return _.maxBy(scores, (s) => s.score);
  }

  public async calculatePlacement(): Promise<void> {
    const scores = await OsuDroidScore.findAndCount({
      where: {
        mapHash: this.mapHash,
        score: MoreThan(this.score),
      },
    });
    this.rank = scores.length + 1;
  }

  public async calculateStatus(previousScore: OsuDroidScore | undefined) {
    const bestScore = OsuDroidScore.getBestScoreFromArray(
      this.previousSubmittedScores
    );

    if (!bestScore) {
      this.status = SubmissionStatus.BEST;
      return;
    }

    if (this.score > bestScore.score) {
      this.status = SubmissionStatus.BEST;
      if (previousScore) {
        this.previousSubmittedScores.push(
          previousScore,
          ...previousScore.previousSubmittedScores
        );
      }
      return;
    }

    this.status = SubmissionStatus.FAILED;
  }
}
