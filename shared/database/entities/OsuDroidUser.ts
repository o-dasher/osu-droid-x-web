import { randomUUID } from "crypto";
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
import RuntimeCache from "../../collections/RuntimeCache";

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
  scores?: OsuDroidScore[];

  @OneToMany(() => OsuDroidStats, (s) => s.user)
  statisticsArray?: OsuDroidStats[];

  readonly previousBestScores = new RuntimeCache<
    string,
    OsuDroidScore | undefined
  >(3);

  get statistics(): OsuDroidStats {
    assertDefined(this.statisticsArray);
    const statistics = this.statisticsArray[0];
    assertDefined(statistics);
    return statistics;
  }

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
    if (this.previousBestScores.has(mapHash)) {
      return this.previousBestScores.get(mapHash);
    }

    const previousBest = await OsuDroidScore.findOne({
      where: {
        player: this,
        mapHash: mapHash,
        status: SubmissionStatus.BEST,
      },
    });

    this.previousBestScores.set(mapHash, previousBest);

    return previousBest;
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

  static async findOneWithStatistics(
    options?: FindOneOptions<OsuDroidUser>,
    mode = OsuDroidGameMode.std
  ): Promise<OsuDroidUser | undefined> {
    const user = await OsuDroidUser.findOne(options);
    if (!user) return;
    user.statisticsArray = [];
    const statistics =
      (await OsuDroidStats.findOne({
        where: {
          user,
          mode,
        },
      })) || new OsuDroidStats().applyDefaults();
    statistics.user = user;
    user.statisticsArray.push(statistics);
    return user;
  }

  override async save(options?: SaveOptions): Promise<this> {
    if (this.statisticsArray && this.statisticsArray.length > 0) {
      const copy = { ...this };
      assertDefined(copy.statisticsArray);
      copy.statisticsArray.forEach((s) => {
        s.user = undefined;
      });
      await OsuDroidUser.save(copy, options);
    } else {
      await super.save(options);
    }
    return this;
  }
}
