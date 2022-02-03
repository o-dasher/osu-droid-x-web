import _ from "lodash";
import {
  BaseEntity,
  Column,
  Entity,
  MoreThanOrEqual,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { SubmissionStatus } from "../../droid/interfaces/IOsuDroidScore";
import IOsuDroidUser from "../../droid/interfaces/IOsuDroidUser";
import OsuDroidScore from "./OsuDroidScore";
import bcrypt from "bcrypt";
import { md5 } from "pure-md5";
import NumberUtils from "../../utils/NumberUtils";

enum Metrics {
  PP = "pp",
  TOTAL_SCORE = "totalScore",
  RANKED_SCORE = "rankedScore",
}

@Entity()
export default class OsuDroidUser extends BaseEntity implements IOsuDroidUser {
  public static METRIC = Metrics.PP;

  @PrimaryGeneratedColumn("increment")
  id!: number;

  @Column("string")
  username!: string;

  @Column("int")
  rank!: number;

  @Column("float")
  accuracy = 100;

  public get droidAccuracy() {
    return Math.round(this.accuracy * 1000);
  }

  @Column("int")
  playcount = 0;

  @Column("float")
  pp = 0;

  @Column("int")
  rankedScore = 0;

  @Column("int")
  totalScore = 0;

  @Column("string", { array: true })
  deviceIDS: string[] = [];

  @Column("string")
  uuid!: string;

  @Column("timestamp")
  lastSeen!: Date;

  @Column("string", { nullable: true })
  playing?: string;

  @OneToMany(() => OsuDroidScore, (s) => s.player)
  scores!: OsuDroidScore[];

  /**
   * The used metric for score system since osu droid does not support pp by default.
   */
  public get metric(): number {
    return OsuDroidUser.METRIC === Metrics.PP
      ? this.pp
      : OsuDroidUser.METRIC === Metrics.RANKED_SCORE
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
  @Column("string")
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

  @Column("string")
  private privateMD5Email!: string;

  /**
   * The user's hashed email.
   */
  get md5Email() {
    return this.privateMD5Email;
  }

  set md5Email(value: string) {
    this.privateMD5Email = md5(value);
  }

  @Column("string")
  public email!: string;

  public async update() {
    this.scores = this.scores || [];

    if (this.id) {
      this.scores = await OsuDroidScore.find({
        where: {
          player: this,
          status: SubmissionStatus.BEST,
        },
        select: ["id", "accuracy", "pp", "status", "score"],
        relations: ["player"],
        order: {
          score: "DESC",
        },
        take: 100,
      });
    } else {
      this.scores.forEach((s) => (s.player = this));
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
      _.sum(this.scores.map((s) => s.accuracy)) /
        Math.min(50, this.scores.length),
      (v) => {
        this.accuracy = v;
      }
    );

    /**
     * Weights pp.
     */
    evaluate(_.sum(this.scores.map((s, i) => s.pp * 0.95 ** i)), (v) => {
      this.pp = v;
    });

    const switchMetricQuery = (metricType: Metrics, compareTo: number) => {
      return OsuDroidUser.METRIC === metricType
        ? MoreThanOrEqual(compareTo)
        : undefined;
    };

    const greaterUsers = await OsuDroidUser.find({
      where: {
        pp: switchMetricQuery(Metrics.PP, this.pp),
        rankedScore: switchMetricQuery(Metrics.RANKED_SCORE, this.rankedScore),
        totalScore: switchMetricQuery(Metrics.TOTAL_SCORE, this.totalScore),
      },
      select: [OsuDroidUser.METRIC],
    });

    this.rank = greaterUsers.length + 1;
  }

  public async submitScore(score: OsuDroidScore) {
    this.playcount++;
    this.totalScore += score.score;

    const bestScore = OsuDroidScore.getBestScoreFromArray(
      score.previousSubmittedScores
    );

    if (bestScore) {
      this.rankedScore -= bestScore.score;
    }

    this.scores = this.scores || [];
    this.scores.push(score);
  }
}
