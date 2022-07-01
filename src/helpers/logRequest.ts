// 3rd-party
import { FastifyRequest } from "fastify";

// lib

export function logRequestStart(
  request: FastifyRequest,
  viewId: string,
): number {
  const now = Date.now();
  const { id: reqId, method, url } = request;
  console.log(
    `[${now}][req] (${reqId}) ${method} ${url} -> ${viewId} (rendering)`,
  );
  return now;
}

export function logRequestEnd(
  startAtUnix: number,
  request: FastifyRequest,
  viewId: string,
  error?: Error,
): void {
  const now = Date.now();
  const reqDurationMs = now - startAtUnix;
  const { id: reqId, method, url } = request;
  console[error != null ? "error" : "log"](
    `[${now}][res] (${reqId}) ${method} ${url} -> ${viewId} (${reqDurationMs}ms)${
      error != null ? ` -> Error: ${error.message}` : ""
    }`,
  );
  return void 0;
}
