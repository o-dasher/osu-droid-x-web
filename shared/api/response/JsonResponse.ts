import { NextApiResponse } from "next";

type JsonResponse<T> = NextApiResponse<{
  data?: T;
  error?: string;
}>;

export default JsonResponse;
