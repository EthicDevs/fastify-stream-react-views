function reduceDuplicatesPredicateDefault<T>(a: T, b: T) {
  if (
    typeof a === "object" &&
    "id" in a &&
    typeof b === "object" &&
    "id" in b
  ) {
    return (a as any).id === (b as any).id;
  } else if (
    typeof a === "object" &&
    "uid" in a &&
    typeof b === "object" &&
    "uid" in b
  ) {
    return (a as any).uid === (b as any).uid;
  } else {
    return a === b;
  }
}

export function reduceDuplicates<T extends unknown = unknown>(
  arr: T[],
  predicate?: (a: T, b: T) => boolean,
): T[] {
  return arr.reduce((acc, current) => {
    const someFn = (value: T) => {
      if (predicate == null) {
        return reduceDuplicatesPredicateDefault<T>(current, value);
      } else {
        return predicate(current, value);
      }
    };
    if (acc.some(someFn) === false) {
      acc.push(current);
    }
    return acc;
  }, [] as T[]);
}
