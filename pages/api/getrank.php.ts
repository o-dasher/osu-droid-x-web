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
import IHasHash from "../../shared/api/query/IHasHash";
import SubmissionStatus from "../../shared/osu_droid/enum/SubmissionStatus";
import Responses from "../../shared/api/response/Responses";
import { assertDefined } from "../../shared/assertions";
import XModUtils from "../../shared/osu/XModUtils";

type body = IHasHash;

const validate = (body: Partial<body>): body is body => {
  return DroidRequestValidator.validateHash(body);
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
  const { hash } = body;

  if (
    DroidRequestValidator.droidStringEndOnInvalidRequest(res, validate(body)) ||
    !validate(body)
  ) {
    return;
  }

  const scores = await OsuDroidScore.find({
    where: {
      mapHash: hash,
      status: SubmissionStatus.BEST,
    },
    order: {
      [OsuDroidScore.metricKey()]: "DESC",
    },
    take: 50,
    relations: ["player"],
  });

  const scoreRes: string[] = [];
  scores.forEach((s, i) => {
    assertDefined(s.player);
    scoreRes.push(
      Responses.ARRAY(
        s.id.toString(),
        s.player.username,
        s.roundedMetric.toString(),
        s.maxCombo.toString(),
        (i + 1).toString(),
        XModUtils.modsToDroidString(s.mods),
        s.accuracyDroid.toString(),
        s.player.md5Email
      )
    );
  });

  res.status(HttpStatusCode.OK).send(Responses.SUCCESS(scores.join("\n")));
}
