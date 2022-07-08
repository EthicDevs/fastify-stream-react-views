// 3rd-party
import React from "react";
import type { FastifyError } from "fastify";

// lib
import type { ReactView } from "../types";

export type DefaultInternalErrorViewProps = {
  error: FastifyError;
};

const DefaultInternalErrorView: ReactView<DefaultInternalErrorViewProps> = ({ error }) => {
  return (
    <div>
      <h1>😵‍💫 Woops... we've encountered an internal error.</h1>
      <p>Sorry but we cannot recover from this error...</p>
      {process.env.NODE_ENV === "development" && (
        <details>
          <summary>Find out more about this error (expert mode):</summary>
          <p>
            [{error.code}] {error.name}: {error.name}
          </p>
          {error.stack != null && <p>{error.stack}</p>}
          {error.validation != null && (
            <p>{JSON.stringify(error.validation, null, 2)}</p>
          )}
        </details>
      )}
      <a
        href="/"
        title={"Hit that bug super hard, that may work!"}
        role={"button"}
      >
        🐞 Try again
      </a>
    </div>
  );
};

export default DefaultInternalErrorView;
