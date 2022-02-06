import "reflect-metadata";

import { NextApiResponse } from "next";
import HTTPMethod from "../../shared/api/enums/HttpMethod";
import NextApiRequestTypedBody from "../../shared/api/query/NextApiRequestTypedBody";
import RequestHandler from "../../shared/api/request/RequestHandler";
import Database from "../../shared/database/Database";
import { PatchArrayAt } from "../../shared/node/PatchArrayAt";
import DroidRequestValidator from "../../shared/type/DroidRequestValidator";
import { OsuDroidScore } from "../../shared/database/entities";
import HttpStatusCode from "../../shared/api/enums/HttpStatusCodes";
import Responses from "../../shared/api/response/Responses";
import XModUtils from "../../shared/osu/XModUtils";

type body = { playID: string };

const validate = (body: Partial<body>): body is body => {
  return typeof body.playID === "string";
};

export default async function handler(
  req: NextApiRequestTypedBody<body>,
  res: NextApiResponse<string>
) {
  PatchArrayAt();
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

  const score = await OsuDroidScore.findOne(playID);

  if (!score) {
    res.status(HttpStatusCode.BAD_REQUEST).send("Score not found.");
    return;
  }

  await score.calculatePlacement();

  res
    .status(HttpStatusCode.OK)
    .send(
      Responses.SUCCESS(
        XModUtils.modsToDroidString(score.mods),
        score.roundedMetric.toString(),
        score.maxCombo.toString(),
        score.rank.toString(),
        score.hGeki.toString(),
        score.h300.toString(),
        score.hKatu.toString(),
        score.h100.toString(),
        score.hMiss.toString(),
        score.h50.toString(),
        score.accuracyDroid.toString()
      )
    );
}
