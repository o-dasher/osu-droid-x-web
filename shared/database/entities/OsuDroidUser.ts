import {
  BaseEntity,
  Column,
  Entity,
  MoreThanOrEqual,
  Not,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { SubmissionStatus } from "../../droid/interfaces/IOsuDroidScore";
import IOsuDroidUser from "../../droid/interfaces/IOsuDroidUser";
import OsuDroidScore from "./OsuDroidScore";
import bcrypt from "bcrypt";
import { md5 } from "pure-md5";
import NumberUtils from "../../utils/NumberUtils";
import IEntityWithDefaultValues from "../interfaces/IEntityWithDefaultValues";
import { randomUUID } from "crypto";

type ppMetric = "pp";
type rankedScoreMetric = "rankedScore";
type totalScoreMetric = "totalScore";

type ppMetrics = ppMetric;
type scoreMetrics = rankedScoreMetric | totalScoreMetric;
type anyMetrics = ppMetrics | scoreMetrics;

enum Metrics {
  pp = "pp",
  rankedScore = "rankedScore",
  totalScore = "totalScore",
}

@Entity()
export default class OsuDroidUser
  extends BaseEntity
  implements IOsuDroidUser, IEntityWithDefaultValues
{
  public static METRIC = Metrics.pp;

  public static ALL_PP_METRICS: anyMetrics[] = ["pp"];

  public static ALL_SCORE_METRICS: anyMetrics[] = ["rankedScore", "totalScore"];

  public static get ALL_METRICS() {
    return [...this.ALL_PP_METRICS, ...this.ALL_SCORE_METRICS];
  }

  @PrimaryGeneratedColumn("increment")
  id!: number;

  @Column()
  username!: string;

  @Column("double precision")
  accuracy!: number;

  public get droidAccuracy() {
    return Math.round(this.accuracy * 1000);
  }

  @Column()
  playcount!: number;

  @Column("double precision")
  pp!: number;

  @Column()
  rankedScore!: number;

  @Column()
  totalScore!: number;

  @Column("string", { array: true })
  deviceIDS!: string[];

  @Column()
  uuid!: string;

  @Column()
  lastSeen!: Date;

  @Column({ nullable: true })
  playing?: string;

  @OneToMany(() => OsuDroidScore, (s) => s.player, { cascade: true })
  scores?: Partial<OsuDroidScore[]>;

  applyDefaults(): this {
    this.accuracy = 100;
    this.lastSeen = new Date();
    this.uuid = randomUUID();
    this.pp = this.rankedScore = this.totalScore = this.playcount = 0;
    this.deviceIDS = [];
    return this;
  }

  /**
   * Gets the user global rank.
   * there may be a overhead on doing this so saving the results in memory is recommended.
   */
  public async getGlobalRank(): Promise<number> {
    return (
      (await OsuDroidUser.count({
        where: {
          id: Not(this.id),
          [OsuDroidUser.METRIC]: MoreThanOrEqual(this[OsuDroidUser.METRIC]),
        },
      })) + 1
    );
  }

  /**
   * The used metric for score system since osu droid does not support pp by default.
   */
  public get metric(): number {
    return OsuDroidUser.METRIC === Metrics.pp
      ? this.pp
      : OsuDroidUser.METRIC === Metrics.rankedScore
      ? this.rankedScore
      : this.totalScore;
  }

  /**
   * Same as {@link metric} except with rounded result.
   */
  public get roundedMetric(): number {
    return Math.round(this.metric);
  }

  /**
   * This is only public for database reference reasons.
   * please use the getter and setter {@link getPassword}, {@link setPassword} instead,
   * when not querying for database.
   */
  @Column()
  privatePassword!: string;

  /**
   * The user's hashed password.
   */
  getPassword() {
    return this.privatePassword;
  }

  async setPassword(value: string) {
    this.privatePassword = await bcrypt.hash(value, 10);
  }

  @Column()
  private privateMD5Email!: string;

  /**
   * The user's hashed email.
   */
  get md5Email() {
    return this.privateMD5Email;
  }

  /**
   * The user's plain text email.
   * do not assign using this value. use {@link setEmail} instead.
   */
  @Column()
  email!: string;

  setEmail(email: string) {
    this.email = email;
    this.privateMD5Email = md5(email);
  }

  async calculateStatus(recentlySubmitted?: OsuDroidScore) {
    const scoresToCalculate = await OsuDroidScore.find({
      where: {
        player: { id: this.id },
        status: SubmissionStatus.BEST,
      },
      select: ["accuracy", "pp"],
      order: {
        [OsuDroidUser.METRIC]: "DESC",
      },
      take: 100,
    });

    if (
      recentlySubmitted &&
      !scoresToCalculate.find((s) => s.id === recentlySubmitted.id)
    ) {
      const lastScoreToCalculate = scoresToCalculate.at(-1);
      if (lastScoreToCalculate) {
        const by = OsuDroidUser.ALL_SCORE_METRICS.includes(OsuDroidUser.METRIC)
          ? (s: OsuDroidScore) => s.score
          : (s: OsuDroidScore) => s.pp;
        if (by(recentlySubmitted) > by(lastScoreToCalculate)) {
          scoresToCalculate[scoresToCalculate.length - 1] = recentlySubmitted;
        }
      }
    }

    if (scoresToCalculate.length === 0) {
      return;
    }

    const evaluate = (res: number, update: (res: number) => void) => {
      if (NumberUtils.isNumber(res)) {
        update(res);
      }
    };

    /**
     * Weights accuracy.
     */
    evaluate(
      scoresToCalculate.map((s) => s.accuracy).reduce((acc, cur) => acc + cur) /
        Math.min(50, scoresToCalculate.length),
      (v) => {
        this.accuracy = v;
      }
    );

    /**
     * Weights pp.
     */
    evaluate(
      scoresToCalculate
        .map((s, i) => s.pp * 0.95 ** i)
        .reduce((acc, cur) => acc + cur),
      (v) => {
        this.pp = v;
      }
    );
  }

  /**
   * return the best score made by this user on the selected {@link mapHash}'s beatmap.
   * @param mapHash The beatmap hash to get the best score from.
   */
  async getBestScoreOnBeatmap(mapHash: string) {
    return await OsuDroidScore.findOne({
      where: {
        playerId: this.id,
        mapHash: mapHash,
        status: SubmissionStatus.BEST,
      },
      loadRelationIds: {
        relations: ["player"],
      },
    });
  }

  async submitScore(score: OsuDroidScore) {
    if (score.status === SubmissionStatus.FAILED) {
      throw "Can't submit a score which it's status is failed.";
    }

    this.scores = this.scores || [];
    this.scores.push(score);

    const submitScoreValue = (key: scoreMetrics) => {
      this[key] += score.score;
    };

    this.playcount++;
    submitScoreValue("totalScore");
    if (score.isBeatmapSubmittable()) {
      submitScoreValue("rankedScore");
      const previousBestScore = await this.getBestScoreOnBeatmap(score.mapHash);
      if (previousBestScore) {
        this.rankedScore -= previousBestScore.score;
      }
    }
  }
}
