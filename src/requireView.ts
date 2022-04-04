import { ReactView } from "./types";

export async function requireView<P>(viewPath: string): Promise<ReactView<P>> {
  const View = await import(viewPath);
  return View as ReactView<P>;
}
