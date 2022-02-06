import {
  BaseEntity,
  Column,
  Entity,
  ManyToOne,
  MoreThanOrEqual,
  Not,
  PrimaryGeneratedColumn,
} from "typeorm";
import IHasID from "../../interfaces/IHasID";
import OsuDroidGameMode from "../../osu_droid/enum/OsuDroidGameMode";
import SubmissionStatus from "../../osu_droid/enum/SubmissionStatus";
import NumberUtils from "../../utils/NumberUtils";
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
export default abstract class OsuDroidStats<M extends OsuDroidGameMode>
  extends BaseEntity
  implements IHasID, ObjectWithMetrics
{
  public static METRIC = Metrics.pp;

  public static ALL_PP_METRICS: AnyMetrics[] = [Metrics.pp];

  public static ALL_SCORE_METRICS: AnyMetrics[] = [
    Metrics.rankedScore,
    Metrics.totalScore,
  ];

  public static get ALL_METRICS() {
    return [...this.ALL_PP_METRICS, ...this.ALL_SCORE_METRICS];
  }

  @PrimaryGeneratedColumn()
  id!: number;

  @Column("int4")
  mode: M = OsuDroidGameMode.std as M;

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

  public get accuracyDroid() {
    return Math.round(this.accuracy * 1000);
  }

  @ManyToOne(() => OsuDroidUser)
  user?: Partial<OsuDroidUser<M>>;

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

  async calculate(recentlySubmitted?: OsuDroidScore<M>) {
    const scoresToCalculate = (await OsuDroidScore.find({
      where: {
        player: this,
        status: SubmissionStatus.BEST,
        mode: this.mode,
      },
      select: ["accuracy", "pp"],
      order: {
        [OsuDroidStats.METRIC]: "DESC",
      },
      take: 100,
    })) as OsuDroidScore<M>[];

    if (
      recentlySubmitted &&
      !scoresToCalculate.find((s) => s.id === recentlySubmitted.id)
    ) {
      const lastScoreToCalculate = scoresToCalculate.at(-1);
      if (lastScoreToCalculate) {
        const by = OsuDroidStats.ALL_SCORE_METRICS.includes(
          OsuDroidStats.METRIC
        )
          ? (s: OsuDroidScore<M>) => s.score
          : (s: OsuDroidScore<M>) => s.pp;
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

    console.log("Finished calculating stats.");
  }
}
