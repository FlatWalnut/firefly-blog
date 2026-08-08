import type { PublishEnv } from "../../../_lib/env";
import { getSession, jsonResponse } from "../../../_lib/auth";

type FunctionContext = { request: Request; env: PublishEnv };

export const onRequestGet = async (context: FunctionContext): Promise<Response> => {
	const session = await getSession(context.request, context.env);
	return jsonResponse(session ? { connected: true, login: session.login } : { connected: false });
};
