import "reflect-metadata";

import { NextApiResponse } from "next";
import HTTPMethod from "../../shared/api/enums/HttpMethod";
import NextApiRequestTypedBody from "../../shared/api/query/NextApiRequestTypedBody";
import RequestHandler from "../../shared/api/request/RequestHandler";
import Database from "../../shared/database/Database";
import { IncomingForm } from "formidable";
import PersistentFile from "formidable/PersistentFile";
import { OsuDroidScore, OsuDroidUser } from "../../shared/database/entities";
import { differenceInSeconds } from "date-fns";
import HttpStatusCode from "../../shared/api/enums/HttpStatusCodes";
import Responses from "../../shared/api/response/Responses";
import EnvironmentConstants from "../../shared/constants/EnvironmentConstants";
import IHasTempFile from "../../shared/io/interfaces/PersistentFileInfo";
import fs from "fs/promises";
import SubmissionStatus from "../../shared/osu_droid/enum/SubmissionStatus";
import { MapInfo, MapStats, Precision } from "@rian8337/osu-base";
import { ReplayAnalyzer } from "@rian8337/osu-droid-replay-analyzer";
import { assertDefined } from "../../shared/assertions";
import { LATEST_REPLAY_VERSION } from "../../shared/osu_droid/enum/ReplayVersions";
import { DroidStarRating } from "@rian8337/osu-difficulty-calculator";
import AccuracyUtils from "../../shared/osu_droid/AccuracyUtils";
import XModUtils from "../../shared/osu/XModUtils";
import ReplayAnalyzerUtils from "../../shared/osu_droid/ReplayAnalyzerUtils";
import { mean } from "lodash";

export const config = {
  api: {
    bodyParser: false,
  },
};

type body = {
  fields: {
    replayID: string;
  };
  files: {
    uploadedfile: PersistentFile & IHasTempFile;
  };
};

const MOD_CONVERSION_BUG_FIXED = false;

export default async function handler(
  req: NextApiRequestTypedBody<body>,
  res: NextApiResponse<string>
) {
  await Database.getConnection();

  if (RequestHandler.endWhenInvalidHttpMethod(req, res, HTTPMethod.POST)) {
    return;
  }

  const formData: body = await new Promise((resolve, reject) => {
    const form = new IncomingForm();
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({
        fields,
        files,
      } as unknown as body);
    });
  });

  console.log("Client:");
  console.log(formData);

  const { replayID } = formData.fields;

  const score = await OsuDroidScore.findOne(replayID, {
    select: [
      "id",
      "date",
      "status",
      "mapHash",
      "pp",
      "modsAcronym",
      "accuracy",
      "h50",
      "h100",
      "h300",
      "hKatu",
      "hGeki",
      "score",
      "maxCombo",
    ],
    relations: ["player"],
  });

  // TODO validate file data (e.g creation date).

  if (!score) {
    console.log("Score not found.");
    res
      .status(HttpStatusCode.BAD_REQUEST)
      .send(Responses.FAILED("Failed to find score to upload replay."));
    return;
  }

  if (score.status !== SubmissionStatus.BEST) {
    console.log("Not a best score.");
    res
      .status(HttpStatusCode.BAD_REQUEST)
      .send(
        Responses.FAILED(
          "The uploaded score isn't the best score from the user on that beatmap."
        )
      );
    return;
  }

  if (score.replay) {
    console.log("Suspicious, replay is already uploaded.");
    res
      .status(HttpStatusCode.BAD_REQUEST)
      .send(Responses.FAILED("Score already has a replay."));
    return;
  }

  const dateNow = new Date();

  const differenceToUpload = differenceInSeconds(dateNow, score.date);

  console.log(`User took ${differenceToUpload} seconds to upload the replay.`);

  if (
    differenceToUpload >= EnvironmentConstants.EDGE_FUNCTION_LIMIT_RESPONSE_TIME
  ) {
    console.log("Suspiciously long wait time to upload score replay.");

    await score.remove();

    res
      .status(HttpStatusCode.BAD_REQUEST)
      .send(Responses.FAILED("Took too long to upload replay file."));

    return;
  }

  const invalidateReplay = async () => {
    console.log("Suspicious replay file.");
    await score.remove();
    res
      .status(HttpStatusCode.BAD_REQUEST)
      .send("Couldn't validate replay integrity.");
  };

  const rawReplay = await fs.readFile(formData.files.uploadedfile.filepath);
  const replayString = rawReplay.toString();

  const ADDITIONAL_CHECK_STRING = "PK";

  if (!replayString.startsWith(ADDITIONAL_CHECK_STRING)) {
    res
      .status(HttpStatusCode.BAD_REQUEST)
      .send(Responses.FAILED("Failed to check validity of replay."));
    return;
  }

  const mapInfo = await MapInfo.getInformation({
    hash: score.mapHash,
  });

  if (!mapInfo.title || !mapInfo.map) {
    console.log("Replay map not found.");
    await invalidateReplay();
    return;
  }

  const replay = new ReplayAnalyzer({
    scoreID: score.id,
    map: mapInfo.map,
  });

  replay.originalODR = rawReplay;

  await replay.analyze();

  const { data } = replay;

  if (!data) {
    await invalidateReplay();
    return;
  }

  if (!MOD_CONVERSION_BUG_FIXED) {
    data.convertedMods.length = 0;
    data.convertedMods.push(...score.mods);
  }

  assertDefined(score.player);

  if (data.playerName !== score.player.username) {
    console.log("Username does not match.");
    await invalidateReplay();
    return;
  }

  if (data.replayVersion < LATEST_REPLAY_VERSION) {
    console.log("Invalid replay version.");
    await invalidateReplay();
    return;
  }

  const dataAccuracy = AccuracyUtils.smallPercentTo100(
    data.accuracy.value(mapInfo.objects)
  );

  const logDifferenceLarge = (whatIsDifferent: string, difference: number) =>
    console.log(`${whatIsDifferent} difference way too big. ${difference}`);

  if (!Precision.almostEqualsNumber(score.accuracy, dataAccuracy)) {
    logDifferenceLarge("Accuracy", score.accuracy - dataAccuracy);
    await invalidateReplay();
    return;
  }

  if (MOD_CONVERSION_BUG_FIXED) {
    if (!XModUtils.checkEquality(data.convertedMods, score.mods)) {
      console.log("Mod combination does not match.");
      console.log(
        `Replay mods: ${XModUtils.toModAcronymString(data.convertedMods)}`
      );
      console.log(`Score mods: ${XModUtils.toModAcronymString(score.mods)}`);
      await invalidateReplay();
      return;
    }
  }

  const MAXIMUM_ACCEPTABLE_DIFFERENCE = 3;

  const validateDifference = async (
    a: number,
    b: number,
    name: string,
    acceptableDifference = MAXIMUM_ACCEPTABLE_DIFFERENCE
  ) => {
    const diff = Math.abs(a - b);
    if (diff > acceptableDifference) {
      logDifferenceLarge(name, diff);
      await invalidateReplay();
      return false;
    }
    return true;
  };

  const MAXIMUM_HITS_DIFFERENCE = MAXIMUM_ACCEPTABLE_DIFFERENCE;

  const validateHitDifference = async (a: number, b: number, name: string) =>
    await validateDifference(a, b, name, MAXIMUM_HITS_DIFFERENCE);

  const validatedKatu = await validateHitDifference(
    data.hit100k,
    score.hKatu,
    "katu"
  );

  if (!validatedKatu) return;

  const validatedGeki = await validateHitDifference(
    data.hit300k,
    score.hGeki,
    "geki"
  );

  if (!validatedGeki) return;

  const validatedCombo = await validateDifference(
    data.maxCombo,
    score.maxCombo,
    "Max combo"
  );

  if (!validatedCombo) return;

  /**
   * Validates the difference between current replay data score, and user submitted score.
   */
  const validateScoreDifference = async (
    name: string,
    replayDataScore = data.score
  ) =>
    await validateDifference(
      replayDataScore,
      score.score,
      name,
      mean([replayDataScore, score.score]) * 0.1
    );

  /**
   * Since we already checked for the combo, the difference of the score must not be too large for validation.
   */
  const validatedScore = await validateScoreDifference("score");

  if (!validatedScore) return;

  /**
   * We then estimate the score for double checking.
   */
  const estimatedScore = ReplayAnalyzerUtils.estimateScore(replay);

  const validatedScoreEstimation = await validateScoreDifference(
    "estimated score",
    estimatedScore
  );

  if (!validatedScoreEstimation) return;

  score.score = estimatedScore;

  const stats = new MapStats({
    ar: data.forcedAR,
    speedMultiplier: data.speedModification,
    isForceAR: Boolean(data.forcedAR),
  });

  replay.map = new DroidStarRating().calculate({
    map: mapInfo.map,
    mods: data.convertedMods,
    stats,
  });

  replay.checkFor3Finger();

  score.pp -= replay.tapPenalty;

  score.replay = replayString;

  /**
   * The score estimation requires it to be a map.
   */
  replay.map = mapInfo.map;

  await score.save();

  await OsuDroidUser.findStatisticsForUser(score.player);

  await score.player.statistics.calculate();
  await score.player.statistics.save();

  res.status(HttpStatusCode.OK).send(Responses.SUCCESS("Replay uploaded."));
}
