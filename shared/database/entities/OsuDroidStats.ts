import {
  Entity,
  BaseEntity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Not,
  MoreThanOrEqual,
  SaveOptions,
} from "typeorm";
import IHasID from "../../interfaces/IHasID";
import AccuracyUtils from "../../osu_droid/AccuracyUtils";
import OsuDroidGameMode from "../../osu_droid/enum/OsuDroidGameMode";
import SubmissionStatus from "../../osu_droid/enum/SubmissionStatus";
import NumberUtils from "../../utils/NumberUtils";
import IEntityWithDefaultValues from "../interfaces/IEntityWithDefaultValues";
import IEntityWithStatsMetrics from "../interfaces/IEntityWithStatsMetrics";
import OsuDroidScore from "./OsuDroidScore";
import OsuDroidUser from "./OsuDroidUser";

export enum Metrics {
  pp = "pp",
  rankedScore = "rankedScore",
  totalScore = "totalScore",
}

export type PPMetrics = Metrics.pp;
export type ScoreMetrics = Metrics.rankedScore | Metrics.totalScore;
export type AnyMetrics = PPMetrics | ScoreMetrics;

export type ObjectWithMetrics = {
  [K in Metrics]: number;
};

@Entity()
export default class OsuDroidStats
  extends BaseEntity
  implements
    IHasID,
    ObjectWithMetrics,
    IEntityWithDefaultValues,
    IEntityWithStatsMetrics
{
  static METRIC = Metrics.pp;

  static ALL_PP_METRICS: AnyMetrics[] = [Metrics.pp];

  static ALL_SCORE_METRICS: AnyMetrics[] = [
    Metrics.rankedScore,
    Metrics.totalScore,
  ];

  static get ALL_METRICS() {
    return [...this.ALL_PP_METRICS, ...this.ALL_SCORE_METRICS];
  }

  @PrimaryGeneratedColumn()
  id!: number;

  @Column("int4")
  mode = OsuDroidGameMode.std;

  @Column("float8")
  pp!: number;

  @Column()
  rankedScore!: number;

  @Column()
  totalScore!: number;

  @Column()
  playcount!: number;

  @Column("float8")
  accuracy!: number;

  public get accuracyDroid(): number {
    return AccuracyUtils.acc100toDroid(this.accuracy);
  }

  @ManyToOne(() => OsuDroidUser, (u) => u.statistics)
  user?: Partial<OsuDroidUser>;

  applyDefaults(): this {
    this.playcount = this.totalScore = this.rankedScore = this.pp = 0;
    this.mode = OsuDroidGameMode.std;
    this.accuracy = 100;
    return this;
  }

  /**
   * The used metric for score system since osu droid does not support pp by default.
   */
  public get metric(): number {
    switch (OsuDroidStats.METRIC) {
      case Metrics.pp:
        return this.pp;
      case Metrics.rankedScore:
        return this.rankedScore;
      case Metrics.totalScore:
        return this.totalScore;
    }
  }

  /**
   * Same as {@link metric} except with rounded result.
   */
  public get roundedMetric(): number {
    return Math.round(this.metric);
  }

  /**
   * Gets the user global rank.
   * there may be a overhead on doing this so saving the results in memory is recommended.
   */
  public async getGlobalRank(): Promise<number> {
    return (
      (await OsuDroidStats.count({
        where: {
          user: Not(this.user),
          mode: this.mode,
          [OsuDroidStats.METRIC]: MoreThanOrEqual(this[OsuDroidStats.METRIC]),
        },
      })) + 1
    );
  }

  async calculate() {
    // WE DO NOT CHECK IF THE ARRAY IS EMPTY BECAUSE SCORES ARE PRONE TO DELETION.
    const scoresToCalculate = await OsuDroidScore.find({
      where: {
        player: this.user,
        status: SubmissionStatus.BEST,
        mode: this.mode,
      },
      select: ["accuracy", "pp"],
      order: {
        [OsuDroidStats.METRIC]: "DESC",
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
      scoresToCalculate.reduce((acc, cur) => acc + cur.accuracy, 0) /
        Math.min(50, scoresToCalculate.length),
      (v) => {
        this.accuracy = v;
      }
    );

    /**
     * Weights pp.
     */
    evaluate(
      scoresToCalculate.reduce((acc, cur, i) => acc + cur.pp * 0.95 ** i, 0),
      (v) => {
        this.pp = v;
      }
    );

    console.log("Finished calculating stats.");
  }

  override async save(options?: SaveOptions): Promise<this> {
    if (this.user) {
      const copy = { ...this };
      copy.user = {
        id: this.user.id,
      };
      await OsuDroidStats.save(copy, options);
    } else {
      await super.save(options);
    }
    return this;
  }
}
