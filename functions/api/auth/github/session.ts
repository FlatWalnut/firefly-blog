import { getSession, jsonResponse } from "../../../_lib/auth";
import { getRepository, type PublishEnv } from "../../../_lib/env";

type FunctionContext = { request: Request; env: PublishEnv };

export const onRequestGet = async (
	context: FunctionContext,
): Promise<Response> => {
	const session = await getSession(context.request, context.env);
	let configured = Boolean(
		context.env.GITHUB_CLIENT_ID &&
			context.env.GITHUB_CLIENT_SECRET &&
			context.env.SESSION_SECRET &&
			context.env.SESSION_SECRET.length >= 32,
	);
	try {
		getRepository(context.env);
	} catch {
		configured = false;
	}
	return jsonResponse(
		session
			? { connected: true, configured, login: session.login }
			: { connected: false, configured },
	);
};
