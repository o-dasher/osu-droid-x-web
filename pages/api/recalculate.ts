import { Accuracy, Beatmap } from "@rian8337/osu-base";
import {
  DroidStarRating,
  DroidPerformanceCalculator,
} from "@rian8337/osu-difficulty-calculator";
import { ReplayAnalyzer } from "@rian8337/osu-droid-replay-analyzer";
import { getStorage } from "firebase-admin/storage";
import { NextApiRequest, NextApiResponse } from "next";
import "reflect-metadata";
import { In } from "typeorm";
import HttpStatusCode from "../../shared/api/enums/HttpStatusCodes";
import { assertDefined } from "../../shared/assertions";
import Database from "../../shared/database/Database";
import {
  OsuDroidScore,
  OsuDroidStats,
  OsuDroidUser,
} from "../../shared/database/entities";
import BeatmapManager from "../../shared/database/managers/BeatmapManager";
import NipaaStorage from "../../shared/database/NipaaStorage";
import { getNipaaFirebaseApp } from "../../shared/database/NippaFirebase";

export default async function handler(_: NextApiRequest, res: NextApiResponse) {
  if (process.env.NODE_ENV === "production") {
    res.status(HttpStatusCode.BAD_REQUEST).end();
    return;
  }

  await Database.getConnection();
  getNipaaFirebaseApp();

  const players = await OsuDroidUser.find({
    relations: ["scores"],
  });

  const scores = players
    .map((player) => {
      assertDefined(player.scores);
      return player.scores;
    })
    .flat();

  const statistics = await OsuDroidStats.find({
    where: {
      userId: In(players.map((p) => p.id)),
    },
  });

  statistics.forEach((stat) => {
    const user = players.find((p) => p.id === stat.userId);
    assertDefined(user);
    user.statisticsArray = [];
    user.statisticsArray.push(stat);
    user.statistics.user = user;
    console.log(`Found stats for ${user.username}`);
  });

  type RecalculationData = {
    score: OsuDroidScore;
    beatmap: Beatmap;
    replay?: Buffer;
  };

  /**
   * This exists for data that should be fetched on advance rather
   * than waiting for calculation, so we get less of an overhead when
   * fetching said data.
   */
  const recalculationData: RecalculationData[] = [];

  const recalculateFromData = async (data: RecalculationData) => {
    const { score, replay, beatmap } = data;

    let replayAnalyzer: ReplayAnalyzer | undefined = undefined;
    if (replay) {
      replayAnalyzer = new ReplayAnalyzer({
        scoreID: score.id,
        map: beatmap,
      });
      replayAnalyzer.originalODR = replay;
      await replayAnalyzer.analyze();
    }

    const accValue = new Accuracy({
      n300: score.h300,
      n100: score.h100,
      n50: score.h50,
      nmiss: score.hMiss,
    });

    const stars = new DroidStarRating().calculate({
      map: beatmap,
      mods: score.mods,
    });

    let tapPenalty = undefined;

    if (replayAnalyzer) {
      replayAnalyzer.map = stars;
      replayAnalyzer.checkFor3Finger();
      tapPenalty = replayAnalyzer.tapPenalty;
    }

    const performance = new DroidPerformanceCalculator().calculate({
      stars,
      accPercent: accValue,
      combo: score.maxCombo,
      tapPenalty,
    });

    score.pp = performance.total;
  };

  for (const score of scores) {
    const mapInfo = await BeatmapManager.fetchBeatmap(score.mapHash);

    assertDefined(mapInfo);
    assertDefined(mapInfo.map);

    console.log(mapInfo.map.title);

    const response = await getStorage()
      .bucket()
      .file(NipaaStorage.pathForReplay(score.id))
      .download()
      .catch(() =>
        console.log(`Failed to download replay file for score: ${score.id}`)
      );

    let replayFile: Buffer | undefined = undefined;
    if (response) {
      replayFile = response[0];
    }

    const data: RecalculationData = {
      score,
      beatmap: mapInfo.map,
      replay: replayFile,
    };

    recalculationData.push(data);
  }

  await Promise.all(
    recalculationData.map(async (data) => await recalculateFromData(data))
  );

  await OsuDroidScore.save(scores);

  await Promise.all(statistics.map(async (stat) => await stat.calculate()));

  await OsuDroidStats.save(statistics);

  res.status(HttpStatusCode.OK).end();
}
