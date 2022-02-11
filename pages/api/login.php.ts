import "reflect-metadata";

import { NextApiResponse } from "next";
import HTTPMethod from "../../shared/api/enums/HttpMethod";
import HttpStatusCode from "../../shared/api/enums/HttpStatusCodes";
import IHasPassword from "../../shared/api/query/IHasPassword";
import IHasUsername from "../../shared/api/query/IHasUsername";
import NextApiRequestTypedBody from "../../shared/api/query/NextApiRequestTypedBody";
import RequestHandler from "../../shared/api/request/RequestHandler";
import Responses from "../../shared/api/response/Responses";
import Database from "../../shared/database/Database";
import { OsuDroidUser } from "../../shared/database/entities";
import bcrypt from "bcrypt";
import DroidRequestValidator from "../../shared/type/DroidRequestValidator";
import AuthConstants from "../../shared/constants/AuthConstants";
import { randomUUID } from "crypto";

type body = IHasUsername & IHasPassword;

// TODO VERSION.
const validate = (body: Partial<body>): body is body => {
  return DroidRequestValidator.untypedValidation(
    body,
    DroidRequestValidator.validateUsername,
    DroidRequestValidator.validatePassword
  );
};

export default async function handler(
  req: NextApiRequestTypedBody<body>,
  res: NextApiResponse<string>
) {
  await Database.getConnection();

  if (RequestHandler.endWhenInvalidHttpMethod(req, res, HTTPMethod.POST)) {
    return;
  }

  if (
    DroidRequestValidator.droidStringEndOnInvalidRequest(
      res,
      validate(req.body)
    ) ||
    !validate(req.body)
  ) {
    return;
  }

  const { username, password } = req.body;

  const user = await OsuDroidUser.findOne({
    where: {
      username,
    },
    select: ["id", "sessionID", "privatePassword", "username"],
  });

  if (DroidRequestValidator.sendUserNotFound(res, user)) {
    return;
  }

  if (username.length < AuthConstants.MIN_USERNAME_LENGTH) {
    res
      .status(HttpStatusCode.BAD_REQUEST)
      .send(
        Responses.FAILED(
          `Username must have more than ${AuthConstants.MIN_USERNAME_LENGTH} characters.`
        )
      );
  }

  const validatedPassword = await bcrypt.compare(password, user.getPassword());

  if (!validatedPassword) {
    res
      .status(HttpStatusCode.BAD_REQUEST)
      .send(Responses.FAILED("Wrong password."));
    return;
  }

  // TODO WE NEED TO BE ABLE TO INVALIDATE THE UUID FROM TIME TO TIME.
  user.sessionID = randomUUID();
  user.lastSeen = new Date();

  await user.save();

  await OsuDroidUser.findStatisticsForUser(user);

  await user.statistics.calculate();
  await user.statistics.save();

  await user.statistics.calculateGlobalRank();

  res
    .status(HttpStatusCode.OK)
    .send(
      Responses.SUCCESS(
        user.id.toString(),
        user.sessionID,
        user.statistics.rank.toString(),
        user.statistics.roundedMetric.toString(),
        user.statistics.accuracyDroid.toString(),
        user.username,
        ""
      )
    );
}
