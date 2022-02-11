import { MapInfo, rankedStatus, Accuracy, MapStats } from "@rian8337/osu-base";
import {
  DroidStarRating,
  DroidPerformanceCalculator,
} from "@rian8337/osu-difficulty-calculator";
import { differenceInSeconds } from "date-fns";
import {
  Entity,
  BaseEntity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  FindConditions,
  MoreThanOrEqual,
  Not,
  In,
} from "typeorm";
import { assertDefined } from "../../assertions";
import EnvironmentConstants from "../../constants/EnvironmentConstants";
import NipaaModUtil from "../../osu/NipaaModUtils";
import AccuracyUtils from "../../osu_droid/AccuracyUtils";
import OsuDroidGameMode from "../../osu_droid/enum/OsuDroidGameMode";
import SubmissionStatus, {
  SubmissionStatusUtils,
} from "../../osu_droid/enum/SubmissionStatus";
import IHasOsuDroidGameMode from "../../osu_droid/interfaces/IHasOsuDroidGameMode";
import NumberUtils from "../../utils/NumberUtils";
import IEntityWithDefaultValues from "../interfaces/IEntityWithDefaultValues";
import IEntityWithStatsMetrics from "../interfaces/IEntityWithStatsMetrics";
import BeatmapManager from "../managers/BeatmapManager";
import OsuDroidStats, { Metrics } from "./OsuDroidStats";
import OsuDroidUser from "./OsuDroidUser";

@Entity()
export default class OsuDroidScore
  extends BaseEntity
  implements
    IHasOsuDroidGameMode,
    IEntityWithDefaultValues,
    IEntityWithStatsMetrics
{
  @PrimaryGeneratedColumn("increment")
  id!: number;

  @Column("int4")
  mode!: OsuDroidGameMode;

  @Column()
  mapHash!: string;

  /**
   * The score's player, set it using {@link setPlayer}
   */
  @ManyToOne(() => OsuDroidUser, (u) => u.scores)
  player?: OsuDroidUser;

  @Column("double precision")
  pp!: number;

  @Column()
  score!: number;

  @Column()
  maxCombo!: number;

  @Column()
  modsAcronym!: string;

  get mods() {
    return NipaaModUtil.pcStringToMods(this.modsAcronym);
  }

  @Column("double precision")
  accuracy!: number;

  get accuracyDroid(): number {
    return AccuracyUtils.acc100toDroid(this.accuracy);
  }

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
  hKatu!: number;

  @Column()
  grade!: string;

  @Column("int2")
  status!: SubmissionStatus;

  @Column({ nullable: true })
  customSpeed?: number;

  @Column()
  fc!: boolean;

  @Column()
  date!: Date;

  rank!: number;

  beatmap?: MapInfo;

  /**
   *
   * @returns the used metric key on this entity.
   */
  static metricKey(): keyof OsuDroidScore {
    switch (OsuDroidStats.METRIC) {
      case Metrics.pp:
        return "pp";
      case Metrics.rankedScore:
      case Metrics.totalScore:
        return "score";
    }
  }

  get metric(): number {
    return this[OsuDroidScore.metricKey()] as number;
  }

  get roundedMetric(): number {
    return Math.round(this.metric);
  }

  applyDefaults(): this {
    this.mode = OsuDroidGameMode.std;
    this.date = new Date();
    this.modsAcronym = "";
    return this;
  }

  static ABLE_TO_SUBMIT_STATUS = [
    rankedStatus.RANKED,
    rankedStatus.LOVED,
    rankedStatus.APPROVED,
  ];

  /**
   *
   * @returns Wether the score was made on a approved for submission beatmap.
   */
  isBeatmapSubmittable() {
    return this.beatmap
      ? OsuDroidScore.ABLE_TO_SUBMIT_STATUS.includes(this.beatmap.approved)
      : false;
  }

  /**
   * Gets an score from a replay data submission,
   * also calls both {@link calculateStatus} and {@link calculatePlacement} on the created score.
   * @param data the replay data from the submission.
   * @param user the owner of the score.
   * @param submit wether to call {@link OsuDroidUser#submitScore}.
   */
  static async fromSubmission(
    data: string,
    user?: OsuDroidUser,
    submit = true
  ): Promise<OsuDroidScore> {
    const dataArray = data.split(" ");

    let score = new OsuDroidScore().applyDefaults();

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

    const fail = (reason: string) => {
      score.status = SubmissionStatus.FAILED;
      console.log(`Failed to get score from submission. "${reason}"`);
    };

    const mods = NipaaModUtil.droidStringToMods(dataArray[0]);

    if (!NipaaModUtil.isModRanked(mods)) {
      fail("Unranked mods.");
      return score;
    }

    score.modsAcronym = NipaaModUtil.toModAcronymString(mods);

    const dataDate = new Date(dataArray[11]);

    /**
     * space between score submission and requesting submission to the server way too long.
     */
    if (
      differenceInSeconds(dataDate, score.date) >
      EnvironmentConstants.EDGE_FUNCTION_LIMIT_RESPONSE_TIME
    ) {
      fail("Timed out.");
      return score;
    }

    const username = dataArray[13];

    if (!user) {
      user = await OsuDroidUser.findOne({
        where: {
          username,
          mode: score.mode,
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
      console.log(user.username);
      console.log(username);
      return score;
    }

    score.player = user;

    if (!user.playing) {
      fail("User isn't playing a beatmap.");
      return score;
    }

    score.mapHash = user.playing;

    const mapInfo = await BeatmapManager.fetchBeatmap(score.mapHash);

    if (!mapInfo || !mapInfo.map) {
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
    score.hKatu = secondIntegerData[2];
    score.h100 = secondIntegerData[3];
    score.h50 = secondIntegerData[4];
    score.hMiss = secondIntegerData[5];

    /**
     * Allows old versions to pass.
     */
    const speedData = dataArray[14];
    if (speedData) {
      const speedString = parseFloat(speedData);
      if (NumberUtils.isNumber(speedString)) {
        score.customSpeed = speedString;
      }
    }

    console.log("Calculating score...");

    const accValue = new Accuracy({
      n300: score.h300,
      n100: score.h100,
      n50: score.h50,
      nmiss: score.hMiss,
    });

    const accPercent = accValue.value(mapInfo.objects);

    score.fc = score.maxCombo === mapInfo.map.maxCombo;

    const stars = new DroidStarRating().calculate({
      map: mapInfo.map,
      mods: score.mods,
      stats: new MapStats({
        mods: score.mods,
        speedMultiplier: score.customSpeed,
      }),
    });

    const performance = new DroidPerformanceCalculator().calculate({
      stars,
      accPercent: accValue,
    });

    score.accuracy = AccuracyUtils.smallPercentTo100(accPercent);

    score.pp = performance.total;

    if (!NumberUtils.isNumber(score.pp) || score.pp < 0) {
      /**
       * Prevents NaN values server side until a fix is found.
       */
      score.pp = 0;
    }

    const previousScore = await user.getBestScoreOnBeatmap(score.mapHash, {
      select: ["id", "status", "score", OsuDroidScore.metricKey()],
    });

    await score.calculateStatus(user, previousScore);
    await score.calculatePlacement();

    if (submit) {
      if (SubmissionStatusUtils.isUserBest(score.status)) {
        await user.submitScore(score, previousScore);
      }
    }

    return score;
  }

  static getBestScoreFromArray(scores: OsuDroidScore[]) {
    return Math.max(...scores.map((s) => s.score));
  }

  /**
   * Calculates the {@link param} of this score, should only be used when the entity has an id.
   */
  async calculatePlacement(): Promise<void> {
    const whereQuery: FindConditions<OsuDroidScore> = {
      mapHash: this.mapHash,
      status: In(SubmissionStatusUtils.USER_BEST_STATUS),
      [OsuDroidScore.metricKey()]: MoreThanOrEqual(this.metric),
    };
    if (this.id) {
      whereQuery.id = Not(this.id);
    }
    const nextRank = await OsuDroidScore.count({
      where: whereQuery,
    });
    this.rank = nextRank + 1;
  }

  async calculateStatus(user: OsuDroidUser, previousBestScore?: OsuDroidScore) {
    assertDefined(this.beatmap);

    if (!previousBestScore) {
      previousBestScore = await user.getBestScoreOnBeatmap(this.mapHash, {
        select: ["id", "status", "score", OsuDroidScore.metricKey()],
      });
    }

    if (!previousBestScore) {
      console.log("Previous best not found...");
      this.changeStatusToApproved();
      return;
    }

    console.log("Previous best found...");

    if (this.metric > previousBestScore.metric) {
      console.log("The new score is better than the previous score.");
      this.changeStatusToApproved();
      previousBestScore.status = SubmissionStatus.SUBMITTED;
      await previousBestScore.save();
      return;
    }

    this.status = SubmissionStatus.FAILED;
  }

  /**
   * Changes the {@link status} to an approved status.
   * requires a beatmap to be passed on the instance.
   */
  changeStatusToApproved() {
    assertDefined(this.beatmap);
    this.status =
      this.beatmap.approved === rankedStatus.RANKED ||
      this.beatmap.approved === rankedStatus.APPROVED
        ? SubmissionStatus.BEST
        : SubmissionStatus.APPROVED;
    console.log(`Changed score approval status to: ${this.status}`);
  }
}
