export const FASTIFY_VERSION_TARGET = `3.x`;

export const HTML_DOCTYPE = `<!DOCTYPE html>`;
export const HTML_MIME_TYPE = `text/html`;

export const ISLAND_RUNTIME_GLOBAL_NAME = "IslandsRuntime";

export const NODE_ENV_STRICT =
  process.env.NODE_ENV === "production" ? "production" : "development";

export const DefaultExternalDependencies = {
  ["react"]: "React",
  ["react-is"]: "ReactIs",
  ["react-dom"]: "ReactDOM",
};
