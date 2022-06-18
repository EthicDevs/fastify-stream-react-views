export function isStyledComponentsAvailable(): boolean {
  try {
    const def = require("styled-components");
    if (def == null) {
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}
