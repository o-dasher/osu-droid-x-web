import { md5 } from "pure-md5";
import {
  Entity,
  BaseEntity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  FindOneOptions,
  SaveOptions,
} from "typeorm";
import OsuDroidGameMode from "../../osu_droid/enum/OsuDroidGameMode";
import SubmissionStatus from "../../osu_droid/enum/SubmissionStatus";
import IEntityWithDefaultValues from "../interfaces/IEntityWithDefaultValues";
import OsuDroidScore from "./OsuDroidScore";
import OsuDroidStats, { ScoreMetrics, Metrics } from "./OsuDroidStats";
import bcrypt from "bcrypt";
import { assertDefined } from "../../assertions";

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

  @Column({ nullable: true })
  sessionID!: string;

  @Column()
  lastSeen!: Date;

  @Column({ nullable: true })
  playing?: string;

  @OneToMany(() => OsuDroidScore, (s) => s.player)
  scores?: OsuDroidScore[];

  @OneToMany(() => OsuDroidStats, (s) => s.user)
  statisticsArray?: OsuDroidStats[];

  get statistics(): OsuDroidStats {
    assertDefined(this.statisticsArray);
    const statistics = this.statisticsArray[0];
    assertDefined(statistics);
    return statistics;
  }

  applyDefaults(): this {
    this.lastSeen = new Date();
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
  async getBestScoreOnBeatmap(
    mapHash: string,
    options?: {
      select?: (keyof OsuDroidScore)[];
      relations?: (keyof OsuDroidScore)[];
    }
  ) {
    const query: FindOneOptions<OsuDroidScore> & Record<string, unknown> = {
      where: {
        player: this,
        mapHash: mapHash,
        status: SubmissionStatus.BEST,
      },
    };

    if (options) {
      const tOptions = options as Record<string, (keyof OsuDroidScore)[]>;
      for (const key in tOptions) {
        const value = tOptions[key];
        if (value) {
          query[key] = value;
        }
      }
    }

    return await OsuDroidScore.findOne(query);
  }

  async submitScore(score: OsuDroidScore, previousBestScore?: OsuDroidScore) {
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
      if (!previousBestScore) {
        previousBestScore = await this.getBestScoreOnBeatmap(score.mapHash, {
          select: ["score"],
        });
      }
      if (previousBestScore) {
        this.statistics.rankedScore -= previousBestScore.score;
      }
    }
  }

  static async findOneWithStatistics(
    options?: FindOneOptions<OsuDroidUser>,
    mode = OsuDroidGameMode.std
  ): Promise<OsuDroidUser | undefined> {
    const user = await OsuDroidUser.findOne(options);
    if (!user) return;
    await this.findStatisticsForUser(user, mode);
    return user;
  }

  static async findStatisticsForUser(
    user: OsuDroidUser,
    mode = OsuDroidGameMode.std
  ): Promise<OsuDroidStats | undefined> {
    user.statisticsArray = [];
    const oldStatistics = await OsuDroidStats.findOne({
      where: {
        user,
        mode,
      },
    });
    const statistics = oldStatistics || new OsuDroidStats().applyDefaults();
    statistics.user = user;
    user.statisticsArray.push(statistics);
    return statistics;
  }

  override async save(options?: SaveOptions): Promise<this> {
    if (this.statisticsArray && this.statisticsArray.length > 0) {
      const copy = { ...this };

      assertDefined(copy.statisticsArray);

      /**
       * Avoids recursive memory referencing when passing json.
       */
      copy.statisticsArray.forEach((s) => (s.user = undefined));

      await OsuDroidUser.save(copy, options);

      copy.statisticsArray.forEach((s) => (s.user = this));
    } else {
      await super.save(options);
    }
    return this;
  }
}
