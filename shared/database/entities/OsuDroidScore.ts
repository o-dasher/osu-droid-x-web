import { Accuracy, MapInfo, ModUtil, rankedStatus } from "@rian8337/osu-base";
import {
  DroidPerformanceCalculator,
  DroidStarRating,
} from "@rian8337/osu-difficulty-calculator";
import {
  BaseEntity,
  Column,
  Entity,
  FindConditions,
  ManyToOne,
  MoreThanOrEqual,
  Not,
  PrimaryGeneratedColumn,
  RelationId,
} from "typeorm";
import { assertDefined } from "../../assertions";
import {
  OmittedPlayerScore,
  SubmissionStatus,
} from "../../droid/interfaces/IOsuDroidScore";
import NumberUtils from "../../utils/NumberUtils";
import OsuDroidUser from "./OsuDroidUser";

@Entity()
export default class OsuDroidScore
  extends BaseEntity
  implements OmittedPlayerScore
{
  @PrimaryGeneratedColumn("increment")
  id!: number;

  @Column()
  mapHash!: string;

  @RelationId((score: OsuDroidScore) => score.player)
  @Column()
  playerId!: number;

  /**
   * The score's player, set it using {@link setPlayer}
   */
  @ManyToOne(() => OsuDroidUser, (u) => u.scores)
  player?: Partial<OsuDroidUser>;

  @Column("double precision")
  pp!: number;

  @Column()
  score!: number;

  @Column()
  maxCombo!: number;

  @Column()
  bitwiseMods!: number;

  get mods() {
    return ModUtil.pcModbitsToMods(this.bitwiseMods);
  }

  @Column("double precision")
  accuracy!: number;

  @Column()
  h300!: number;

  @Column()
  h100!: number;

  @Column()
  h50!: number;

  @Column()
  hMiss!: number;

  @Column()
  hGeki!: number;

  @Column()
  hKatsu!: number;

  @Column()
  grade!: string;

  /**
   * TODO: figure out wether is it really necessary to save this to the db.
   * maybe a getter like the one at {@link OsuDroidUser} should be better.
   */
  @Column()
  rank!: number;

  @Column("int")
  status!: SubmissionStatus;

  @Column()
  fc!: boolean;

  @Column()
  deviceID!: string;

  beatmap?: MapInfo;

  public static ABLE_TO_SUBMIT_STATUS = [
    rankedStatus.RANKED,
    rankedStatus.LOVED,
    rankedStatus.APPROVED,
  ];

  /**
   *
   * @returns Wether the score was made on a approved for submission beatmap.
   */
  public isBeatmapSubmittable() {
    return this.beatmap
      ? OsuDroidScore.ABLE_TO_SUBMIT_STATUS.includes(this.beatmap.approved)
      : false;
  }

  /**
   * Gets an score from a replay data submission,
   * also calls both {@link calculateStatus} and {@link calculatePlacement} on the created score.
   * @param data the replay data from the submission.
   */
  public static async fromSubmission(
    data: string,
    user?: OsuDroidUser
  ): Promise<OsuDroidScore> {
    const dataArray = data.split(" ");

    let score = new OsuDroidScore();

    if (!dataArray.every((data) => data !== undefined)) {
      return score;
    }

    assertDefined(dataArray[0]);
    assertDefined(dataArray[1]);
    assertDefined(dataArray[2]);
    assertDefined(dataArray[3]);
    assertDefined(dataArray[4]);
    assertDefined(dataArray[5]);
    assertDefined(dataArray[6]);
    assertDefined(dataArray[7]);
    assertDefined(dataArray[8]);
    assertDefined(dataArray[9]);
    assertDefined(dataArray[10]);
    assertDefined(dataArray[11]);
    assertDefined(dataArray[12]);
    assertDefined(dataArray[13]);

    const username = dataArray[13];

    const fail = (reason: string) => {
      score.status = SubmissionStatus.FAILED;
      console.log(`Failed to get score from submission. "${reason}"`);
    };

    if (!user) {
      user = await OsuDroidUser.findOne({
        where: {
          username,
        },
        select: ["username", "playing"],
      });
      if (!user) {
        fail("Score player not found.");
        return score;
      }
    }

    if (user.username !== username) {
      fail("Invalid score username.");
      return score;
    }

    score.player = user;

    if (!user.playing) {
      fail("User isn't playing a beatmap.");
      return score;
    }

    score.mapHash = user.playing;

    const mapInfo = await MapInfo.getInformation({
      hash: score.mapHash,
    });

    if (!mapInfo.title || !mapInfo.map) {
      fail("Score's beatmap not found.");
      return score;
    }

    score.beatmap = mapInfo;

    if (!score.isBeatmapSubmittable()) {
      fail("Beatmap not approved.");
      return score;
    }

    console.log("Logging replay data.");

    dataArray.forEach((d) => {
      console.log(d);
    });

    console.log("Finished log.");

    if (user) {
      throw "";
    }

    score.bitwiseMods = ModUtil.droidStringToMods(dataArray[0])
      .map((m) => m.bitwise)
      .reduce((acc, cur) => acc + cur, 0);

    const sliceDataToInteger = (from: number, to: number) => {
      const integerData = dataArray.slice(from, to).map((v) => parseInt(v));
      if (!integerData.every((v) => NumberUtils.isNumber(v))) {
        console.log("Invalid data, passed for score.");
        return;
      }
      return integerData;
    };

    const firstIntegerData = sliceDataToInteger(1, 3);
    if (!firstIntegerData) {
      fail("Invalid replay firstIntegerData.");
      return score;
    }

    assertDefined(firstIntegerData[0]);
    assertDefined(firstIntegerData[1]);

    score.score = firstIntegerData[0];
    score.maxCombo = firstIntegerData[1];

    score.grade = dataArray[3];

    const secondIntegerData = sliceDataToInteger(4, 10);
    if (!secondIntegerData) {
      fail("Invalid replay secondIntegerData.");
      return score;
    }

    assertDefined(secondIntegerData[0]);
    assertDefined(secondIntegerData[1]);
    assertDefined(secondIntegerData[2]);
    assertDefined(secondIntegerData[3]);
    assertDefined(secondIntegerData[4]);
    assertDefined(secondIntegerData[5]);

    score.hGeki = secondIntegerData[0];
    score.h300 = secondIntegerData[1];
    score.hKatsu = secondIntegerData[2];
    score.h100 = secondIntegerData[3];
    score.h50 = secondIntegerData[4];
    score.hMiss = secondIntegerData[5];

    score.deviceID = dataArray[11];

    console.log("Calculating score...");

    const accPercent = new Accuracy({
      n300: score.h300,
      n100: score.h100,
      n50: score.h50,
      nmiss: score.hMiss,
    }).value(mapInfo.objects);

    score.fc = score.maxCombo === mapInfo.map.maxCombo;

    const stars = new DroidStarRating().calculate({
      map: mapInfo.map,
      mods: score.mods,
    });

    const performance = new DroidPerformanceCalculator().calculate({
      stars,
      accPercent: accPercent,
    });

    score.accuracy = accPercent * 100;

    score.pp = performance.total;

    await score.calculateStatus(user);
    await score.calculatePlacement();

    return score;
  }

  public static getBestScoreFromArray(scores: OsuDroidScore[]) {
    return Math.max(...scores.map((s) => s.score));
  }

  /**
   * Calculates the {@link param} of this score, should only be used when the entity has an id.
   */
  public async calculatePlacement(): Promise<void> {
    const whereQuery: FindConditions<OsuDroidScore> = {
      mapHash: this.mapHash,
      score: MoreThanOrEqual(this.score),
      status: SubmissionStatus.BEST,
    };
    if (this.id) {
      whereQuery.id = Not(this.id);
    }
    const nextRank = await OsuDroidScore.count({
      where: whereQuery,
    });
    this.rank = nextRank + 1;
  }

  public async calculateStatus(user: OsuDroidUser) {
    const previousBestScore = await user.getBestScoreOnBeatmap(this.mapHash);

    if (!previousBestScore) {
      this.status = SubmissionStatus.BEST;
      return;
    }

    if (this.score > previousBestScore.score) {
      this.status = SubmissionStatus.BEST;
      previousBestScore.status = SubmissionStatus.SUBMITTED;
      await previousBestScore.save();
      return;
    }

    this.status = SubmissionStatus.FAILED;
  }
}
