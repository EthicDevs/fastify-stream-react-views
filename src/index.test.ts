// 3rd party - fastify std
import fastify from "fastify";

// lib
import * as lib from "./index";

describe("@ethicdevs/fastify-stream-react-views", () => {
  test("it exports default a FastifyPluginAsync", () => {
    expect(lib).toHaveProperty("default", lib.default);
  });

  test("it should register into fastify", () => {
    const server = fastify();
    server.register(lib.default);
    expect(server.hasReplyDecorator("streamReactView"));
  });
});
