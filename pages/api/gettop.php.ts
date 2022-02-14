import "reflect-metadata";
import "core-js/actual/array/at";

import { NextApiResponse } from "next";
import HTTPMethod from "../../shared/api/enums/HttpMethod";
import NextApiRequestTypedBody from "../../shared/api/query/NextApiRequestTypedBody";
import RequestHandler from "../../shared/api/request/RequestHandler";
import Database from "../../shared/database/Database";
import DroidRequestValidator from "../../shared/type/DroidRequestValidator";
import { OsuDroidScore } from "../../shared/database/entities";
import HttpStatusCode from "../../shared/api/enums/HttpStatusCodes";
import Responses from "../../shared/api/response/Responses";
import NipaaModUtil from "../../shared/osu/NipaaModUtils";
import { assertDefined } from "../../shared/assertions";

type body = { playID: string };

const validate = (body: Partial<body>): body is body => {
  return typeof body.playID === "string";
};

export default async function handler(
  req: NextApiRequestTypedBody<body>,
  res: NextApiResponse<string>
) {
  await Database.getConnection();

  if (RequestHandler.endWhenInvalidHttpMethod(req, res, HTTPMethod.POST)) {
    return;
  }

  const { body } = req;
  const { playID } = body;

  if (
    DroidRequestValidator.droidStringEndOnInvalidRequest(res, validate(body)) ||
    !validate(body)
  ) {
    return;
  }

  const score = await OsuDroidScore.findOne(playID, {
    relations: ["player"],
  });

  if (!score) {
    res.status(HttpStatusCode.BAD_REQUEST).send("Score not found.");
    return;
  }

  assertDefined(score.player);

  await score.calculatePlacement();

  res
    .status(HttpStatusCode.OK)
    .send(
      Responses.SUCCESS(
        NipaaModUtil.droidStringFromScore(score),
        score.roundedMetric.toString(),
        score.maxCombo.toString(),
        score.grade,
        score.hGeki.toString(),
        score.h300.toString(),
        score.hKatu.toString(),
        score.h100.toString(),
        score.h50.toString(),
        score.hMiss.toString(),
        score.accuracyDroid.toString(),
        score.date.getTime().toString(),
        Number(score.fc).toString(),
        score.player.username
      )
    );
}
