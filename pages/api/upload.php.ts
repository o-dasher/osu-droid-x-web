import "reflect-metadata";

import { NextApiResponse } from "next";
import HTTPMethod from "../../shared/api/enums/HttpMethod";
import NextApiRequestTypedBody from "../../shared/api/query/NextApiRequestTypedBody";
import RequestHandler from "../../shared/api/request/RequestHandler";
import Database from "../../shared/database/Database";
import { IncomingForm } from "formidable";
import PersistentFile from "formidable/PersistentFile";
import { OsuDroidScore } from "../../shared/database/entities";
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
      "bitwiseMods",
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
    differenceToUpload >=
      EnvironmentConstants.EDGE_FUNCTION_LIMIT_RESPONSE_TIME &&
    // test
    !dateNow
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

  if (
    data.convertedMods.map((m) => m.bitwise).reduce((acc, cur) => acc + cur) !==
    score.bitwiseMods
  ) {
    console.log("Mod combination does not match.");
    await invalidateReplay();
    return;
  }

  const MAXIMUM_DISCREPANCY = 3;

  const maximumHitsDiscrepancy = MAXIMUM_DISCREPANCY;

  if (data.hit100k - maximumHitsDiscrepancy > score.hKatu) {
    logDifferenceLarge("katu", score.hKatu - data.hit100k);
    await invalidateReplay();
    return;
  }

  if (data.hit300k - maximumHitsDiscrepancy > score.hGeki) {
    logDifferenceLarge("geki", score.hGeki - data.hit300k);
    await invalidateReplay();
    return;
  }

  if (data.maxCombo - MAXIMUM_DISCREPANCY > score.maxCombo) {
    logDifferenceLarge("Max combo", score.maxCombo - data.maxCombo);
    await invalidateReplay();
    return;
  }

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

  await score.save();

  res.status(HttpStatusCode.OK).send(Responses.SUCCESS("Replay uploaded."));
}
