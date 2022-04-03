import { ReactView } from "./types";

export function requireView<P>(viewPath: string): ReactView<P> {
  const View = require(viewPath);
  return View as ReactView<P>;
}
