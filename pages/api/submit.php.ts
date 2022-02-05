import "reflect-metadata";

import type { NextApiResponse } from "next";
import HTTPMethod from "../../shared/api/enums/HttpMethod";
import HttpStatusCode from "../../shared/api/enums/HttpStatusCodes";
import NextApiRequestTypedBody from "../../shared/api/query/NextApiRequestTypedBody";
import RequestHandler from "../../shared/api/request/RequestHandler";
import DroidRequestValidator from "../../shared/type/DroidRequestValidator";
import Responses from "../../shared/api/response/Responses";
import OsuDroidUser from "../../shared/database/entities/OsuDroidUser";
import IHasUserID from "../../shared/api/query/IHasUserID";
import IHasSSID from "../../shared/api/query/IHasSSID";
import IHasHash from "../../shared/api/query/IHasHash";
import IHasData from "../../shared/api/query/IHasData";
import OsuDroidScore from "../../shared/database/entities/OsuDroidScore";
import { SubmissionStatus } from "../../shared/droid/interfaces/IOsuDroidScore";
import Database from "../../shared/database/Database";
import { assertDefined } from "../../shared/assertions";
import { PatchArrayAt } from "../../shared/node/PatchArrayAt";
import { FindOneOptions } from "typeorm";

type body = IHasUserID<string> &
  Partial<IHasData<string> & { playID: string } & IHasSSID & IHasHash>;

const validate = (body: Partial<body>): body is body => {
  return DroidRequestValidator.validateUserID(body);
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
  const { userID, ssid, hash, data } = body;

  if (
    DroidRequestValidator.droidStringEndOnInvalidRequest(res, validate(body)) ||
    !validate(body)
  ) {
    return;
  }

  let user: OsuDroidUser | undefined;

  const queryUser = async (options: FindOneOptions<OsuDroidUser>) => {
    user = await OsuDroidUser.findOne(userID, options);
  };

  if (
    DroidRequestValidator.untypedValidation(
      body,
      DroidRequestValidator.validateHash,
      DroidRequestValidator.validateSSID
    )
  ) {
    assertDefined(hash);
    assertDefined(ssid);

    console.log("Submission playing ping.");

    await queryUser({
      select: ["id", "playing", "uuid"],
    });

    if (DroidRequestValidator.sendUserNotFound(res, user)) {
      return;
    }

    if (ssid !== user.uuid) {
      res
        .status(HttpStatusCode.BAD_REQUEST)
        .send(
          Responses.FAILED("Error while approving login, please try again.")
        );
      return;
    }

    if (user.playing !== hash) {
      user.playing = hash;
      await user.save();
    }

    res
      .status(HttpStatusCode.OK)
      .send(Responses.SUCCESS((1).toString(), user.id.toString()));
  } else if (typeof data === "string") {
    console.log("Submitting a score...");

    const score = await OsuDroidScore.fromSubmission(data, user);

    /**
     * although pp and accuracy is calculated regardless of then being queried here or not (Work as intended.)
     * we still load then because we may use the already present values if we can't actually submit the score
     * for other reasons, such as passing to the client if necessary.
     */
    await queryUser({
      select: [
        "id",
        "username",
        "playing",
        "playcount",
        "accuracy",
        ...OsuDroidUser.ALL_METRICS,
      ],
    });

    if (DroidRequestValidator.sendUserNotFound(res, user)) {
      return;
    }

    const sendSuccessResponse = async () => {
      assertDefined(user);

      if (!score.isBeatmapSubmittable()) {
        throw "The score must be done on a submittable beatmap to be uploaded.";
      }

      const canSubmit = score.status === SubmissionStatus.BEST;
      const extraResponse: string[] = [];

      if (canSubmit) {
        console.log("Saving a submitted score into the database...");

        await OsuDroidScore.createQueryBuilder()
          .insert()
          .values(score)
          .into(OsuDroidScore)
          .execute();

        await user.submitScore(score);
        await user.calculateStatus(score);

        extraResponse.push(score.id.toString());
      }

      user.lastSeen = new Date();

      console.log("Saving a user who submitted a score...");

      await user.save();

      const userRank = await user.getGlobalRank();

      const response: string[] = [
        userRank.toString(),
        user.roundedMetric.toString(),
        user.droidAccuracy.toString(),
        score.rank.toString(),
        ...extraResponse,
      ];

      console.log("Saving a user who submitted a score into a database...");

      res.status(HttpStatusCode.OK).send(Responses.SUCCESS(...response));
    };

    if (score.status === SubmissionStatus.FAILED) {
      if (score.isBeatmapSubmittable()) {
        await sendSuccessResponse();
      } else {
        res
          .status(HttpStatusCode.BAD_REQUEST)
          .send(
            Responses.FAILED(`Failed to submit score. (approved = ${false})`)
          );
      }
      return;
    }

    await sendSuccessResponse();
  } else {
    res
      .status(HttpStatusCode.BAD_REQUEST)
      .send(Responses.FAILED(Responses.UNEXPECTED_BEHAVIOR));
  }
}
