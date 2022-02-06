import {
  BaseEntity,
  Column,
  Entity,
  FindOneOptions,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import OsuDroidScore from "./OsuDroidScore";
import bcrypt from "bcrypt";
import { md5 } from "pure-md5";
import IEntityWithDefaultValues from "../interfaces/IEntityWithDefaultValues";
import { randomUUID } from "crypto";
import OsuDroidStats, { Metrics, ScoreMetrics } from "./OsuDroidStats";
import OsuDroidGameMode from "../../osu_droid/enum/OsuDroidGameMode";
import SubmissionStatus from "../../osu_droid/enum/SubmissionStatus";

@Entity()
export default class OsuDroidUser
  extends BaseEntity
  implements IEntityWithDefaultValues
{
  @PrimaryGeneratedColumn("increment")
  id!: number;

  @Column()
  username!: string;

  @Column("string", { array: true })
  deviceIDS!: string[];

  @Column()
  uuid!: string;

  @Column()
  lastSeen!: Date;

  @Column({ nullable: true })
  playing?: string;

  @OneToMany(() => OsuDroidScore, (s) => s.player)
  scores!: OsuDroidScore[];

  @OneToMany(() => OsuDroidStats, (s) => s.user)
  statistics!: OsuDroidStats;

  mode = OsuDroidGameMode.std;

  applyDefaults(): this {
    this.lastSeen = new Date();
    this.uuid = randomUUID();
    this.deviceIDS = [];
    return this;
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

  /**
   * return the best score made by this user on the selected {@link mapHash}'s beatmap.
   * @param mapHash The beatmap hash to get the best score from.
   */
  async getBestScoreOnBeatmap(mapHash: string) {
    return await OsuDroidScore.findOne({
      where: {
        player: this,
        mapHash: mapHash,
        status: SubmissionStatus.BEST,
      },
    });
  }

  async submitScore(score: OsuDroidScore) {
    if (score.status === SubmissionStatus.FAILED) {
      throw "Can't submit a score which it's status is failed.";
    }

    const submitScoreValue = (key: ScoreMetrics) => {
      this.statistics[key] += score.score;
    };

    this.statistics.playcount++;
    submitScoreValue(Metrics.totalScore);
    if (score.isBeatmapSubmittable()) {
      submitScoreValue(Metrics.rankedScore);
      const previousBestScore = await this.getBestScoreOnBeatmap(score.mapHash);
      if (previousBestScore) {
        this.statistics.rankedScore -= previousBestScore.score;
      }
    }
  }

  public static async findOneWithStatistics(
    options?: FindOneOptions<OsuDroidUser>,
    mode = OsuDroidGameMode.std
  ): Promise<OsuDroidUser | undefined> {
    const user = await OsuDroidUser.findOne(options);
    if (!user) return;
    user.statistics =
      (await OsuDroidStats.findOne({
        where: {
          user,
          mode,
        },
      })) || user.statistics;
    user.statistics.user = user;
    return user;
  }
}
