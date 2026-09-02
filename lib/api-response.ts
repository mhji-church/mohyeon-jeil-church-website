function safeErrorCause(error: unknown) {
  if (!error || typeof error !== "object") return { name: "UnknownError" };
  const candidate = error as { name?: unknown; code?: unknown };
  return {
    name: typeof candidate.name === "string" ? candidate.name.slice(0, 60) : "Error",
    code: typeof candidate.code === "string" ? candidate.code.slice(0, 60) : undefined,
  };
}

export function logServerError(context: string, error: unknown, requestId = crypto.randomUUID()) {
  console.error(JSON.stringify({ requestId, context, cause: safeErrorCause(error) }));
  return requestId;
}

export function apiError(
  context: string,
  error: unknown,
  message: string,
  status = 500,
) {
  const requestId = logServerError(context, error);
  return Response.json(
    { error: message, requestId },
    { status, headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
