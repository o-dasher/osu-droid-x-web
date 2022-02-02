import { NextApiRequest } from "next";

export type OmittedBodyNextApiRequest = Omit<NextApiRequest, "body">;

export type ValidatedNextApiRequestTypedBody<T> = {
  body: T;
} & OmittedBodyNextApiRequest;

type NextApiRequestTypedBody<T> = {
  body: Partial<T>;
} & OmittedBodyNextApiRequest;

export default NextApiRequestTypedBody;
