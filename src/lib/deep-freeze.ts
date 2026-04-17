export function deepFreeze<T>(value: T): T {
  if (
    value === null ||
    value === undefined ||
    (typeof value !== "object" && typeof value !== "function") ||
    Object.isFrozen(value)
  ) {
    return value;
  }

  Object.freeze(value);

  Object.getOwnPropertyNames(value).forEach((key) => {
    const nestedValue = (value as Record<string, unknown>)[key];
    if (
      nestedValue &&
      (typeof nestedValue === "object" || typeof nestedValue === "function")
    ) {
      deepFreeze(nestedValue);
    }
  });

  return value;
}
