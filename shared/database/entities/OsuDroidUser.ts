import _ from "lodash";
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

enum Metrics {
  pp = "pp",
  rankedScore = "rankedScore",
  totalScore = "totalScore",
}

@Entity()
export default class OsuDroidUser extends BaseEntity implements IOsuDroidUser {
  public static METRIC = Metrics.pp;

  @PrimaryGeneratedColumn("increment")
  id!: number;

  @Column("string")
  username!: string;

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
    const scoresToCalculate = await OsuDroidScore.find({
      where: {
        player: this,
        status: SubmissionStatus.BEST,
      },
      select: ["accuracy", "pp"],
      order: {
        pp: "DESC",
      },
      take: 100,
    });

    const evaluate = (res: number, update: (res: number) => void) => {
      if (NumberUtils.isNumber(res)) {
        update(res);
      }
    };

    /**
     * Weights accuracy.
     */
    evaluate(
      _.sumBy(scoresToCalculate, (s) => s.accuracy) /
        Math.min(50, scoresToCalculate.length),
      (v) => {
        this.accuracy = v;
      }
    );

    /**
     * Weights pp.
     */
    evaluate(_.sum(scoresToCalculate.map((s, i) => s.pp * 0.95 ** i)), (v) => {
      this.pp = v;
    });
  }

  /**
   * return the best score made by this user on the selected {@link mapHash}'s beatmap.
   * @param mapHash The beatmap hash to get the best score from.
   */
  public async getBestScoreOnBeatmap(mapHash: string) {
    return await OsuDroidScore.findOne({
      where: {
        player: this,
        mapHash: mapHash,
        status: SubmissionStatus.BEST,
      },
    });
  }

  public async submitScore(score: OsuDroidScore) {
    this.playcount++;
    this.totalScore += score.score;

    const previousBestScore = await this.getBestScoreOnBeatmap(score.mapHash);

    if (previousBestScore) {
      this.rankedScore -= previousBestScore.score;
    }

    this.scores.push(score);
  }
}
