import type { PublishEnv } from "../../../_lib/env";
import { clearAuthCookies } from "../../../_lib/auth";

type FunctionContext = { request: Request; env: PublishEnv };

export const onRequestPost = (context: FunctionContext): Response => {
	return new Response(null, { status: 204, headers: clearAuthCookies(context.request) });
};
