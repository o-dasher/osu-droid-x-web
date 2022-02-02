import _ from "lodash";
import {
  BaseEntity,
  Column,
  Entity,
  MoreThan,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { SubmissionStatus } from "../../droid/interfaces/IOsuDroidScore";
import IOsuDroidUser from "../../droid/interfaces/IOsuDroidUser";
import OsuDroidScore from "./OsuDroidScore";
import passwordHasher from "password-hash";
import { md5 } from "pure-md5";

enum Metrics {
  PP,
  TOTAL_SCORE,
  RANKED_SCORE,
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

  @Column("float", { default: 100 })
  accuracy = 100;

  @Column("int", { default: 0 })
  playcount = 0;

  @Column("float", { default: 0 })
  pp = 0;

  @Column("int", { default: 0 })
  rankedScore = 0;

  @Column("int", { default: 0 })
  totalScore = 0;

  @Column("string", { array: true, default: [] })
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
  public get metric() {
    return OsuDroidUser.METRIC === Metrics.PP
      ? this.pp
      : OsuDroidUser.METRIC === Metrics.RANKED_SCORE ?? this.totalScore;
  }

  @Column("string")
  private privatePassword!: string;

  /**
   * The user's hashed password.
   */
  get password() {
    return this.privatePassword;
  }

  set password(value: string) {
    this.privatePassword = passwordHasher.generate(value);
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
    const scores = await OsuDroidScore.find({
      where: {
        player: this,
        status: SubmissionStatus.BEST,
      },
      select: ["accuracy", "pp", "status"],
      relations: ["player"],
      order: {
        score: "DESC",
      },
      take: 100,
    });

    scores.forEach((s) => (s.player = this));

    if (scores.length === 0) {
      return;
    }

    /**
     * Weights accuracy.
     */
    this.accuracy =
      _.sum(scores.map((s) => s.accuracy)) / Math.min(50, scores.length);

    /**
     * Weights pp.
     */
    this.pp = _.sum(scores.map((s, i) => s.pp * 0.95 ** i));

    const switchMetricQuery = (metricType: Metrics, compareTo: number) => {
      return OsuDroidUser.METRIC === metricType
        ? MoreThan(compareTo)
        : undefined;
    };

    const greaterUsers = await OsuDroidUser.find({
      where: {
        pp: switchMetricQuery(Metrics.PP, this.pp),
        rankedScore: switchMetricQuery(Metrics.RANKED_SCORE, this.rankedScore),
        totalScore: switchMetricQuery(Metrics.TOTAL_SCORE, this.totalScore),
      },
      select: ["pp", "rankedScore", "totalScore"],
    });

    this.rank = greaterUsers.length + 1;

    await OsuDroidUser.save(this);
  }
}
