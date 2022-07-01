export function removeCommentsAndSpacing(str: string = "") {
  return str.replace(/\/\*.*\*\//g, " ").replace(/\s+/g, " ");
}
