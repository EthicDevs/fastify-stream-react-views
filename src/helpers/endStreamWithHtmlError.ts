import stream from "stream";

export async function endStreamWithHtmlError(
  stream: stream.PassThrough,
  error: Error,
  stripStr: string = "",
): Promise<void> {
  const stripRegExp = new RegExp(`${stripStr}`, "gmi");
  stream.end(
    `<div style='font-family:monospace;'><h1>${
      error.name
    }</h1><p>${error.message.replace("\n", "<br />")}</p>${
      error.stack == null
        ? ""
        : `<pre style="max-width:100%;white-space:pre-wrap;"><code>${error.stack
            .split("\n")
            .slice(1)
            .join("\n")
            .replace(stripRegExp, "")}</code></pre>`
    }</div></body></html>`,
  );
  return void 0;
}
