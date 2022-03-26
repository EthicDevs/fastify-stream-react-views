/* Types */
import type { StreamReactViewFunction } from "./types";
declare module "fastify" {
  interface FastifyReply {
    // A reply utility function that stream a React Component as the reply
    streamReactView: StreamReactViewFunction;
  }
}

export { StreamReactViewPluginOptions, ViewContextBase } from "./types";

/* Register Function */
import { makePlugin } from "./pluginFactory";

/* Export the plugin */
export default makePlugin();
