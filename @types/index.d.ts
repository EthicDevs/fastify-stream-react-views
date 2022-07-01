import type { StreamReactViewFunction } from "./types";

declare module "fastify" {
  export interface FastifyReply {
    // A reply utility function that stream a React Component as the reply
    streamReactView: StreamReactViewFunction;
  }
}
