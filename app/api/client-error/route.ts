import { NextResponse } from "next/server";
import { z } from "zod";

import { OBS_EVENT } from "@/lib/observability/events";
import { logger } from "@/lib/observability/logger";
import { getClientIpHash, getRequestIdOrCreate } from "@/lib/request-utils";
import { withObservedRoute } from "@/lib/observability/with-observed-route";

const clientErrorSchema = z.object({
  name: z.string().max(200).optional(),
  message: z.string().max(4000).optional(),
  stack: z.string().max(12000).optional(),
  digest: z.string().max(200).optional(),
  url: z.string().url().optional(),
  userAgent: z.string().max(1000).optional(),
});

const postHandler = async (request: Request) => {
  const requestId = getRequestIdOrCreate(request);
  const ipHash = getClientIpHash(request);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  const parsed = clientErrorSchema.safeParse(payload);
  if (!parsed.success) {
    logger.warn({
      event: OBS_EVENT.CLIENT_UNHANDLED_ERROR,
      requestId,
      ipHash,
      parseError: parsed.error.issues.map((issue) => issue.message).join("; "),
    });
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  logger.error({
    event: OBS_EVENT.CLIENT_UNHANDLED_ERROR,
    requestId,
    ipHash,
    errorName: parsed.data.name,
    errorMessage: parsed.data.message,
    digest: parsed.data.digest,
    url: parsed.data.url,
    userAgent: parsed.data.userAgent,
    stack: parsed.data.stack,
  });

  return NextResponse.json({ ok: true }, { status: 202 });
};

export const POST = withObservedRoute("POST /api/client-error", postHandler);
