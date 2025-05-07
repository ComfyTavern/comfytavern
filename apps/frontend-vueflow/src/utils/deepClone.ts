/**
 * Performs a deep clone of an object using JSON stringify/parse.
 * Note: This method does not handle functions, Date objects, RegExp objects,
 * Map, Set, or circular references correctly. Use with caution for simple data structures.
 * @param obj The object to clone.
 * @returns A deep clone of the object.
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (e) {
    console.error("Deep clone failed:", e);
    // Fallback or throw error depending on requirements
    // For simplicity, returning the original object might prevent crashes,
    // but could lead to unexpected shared references.
    // Consider a more robust cloning library (like lodash.clonedeep) for complex objects.
    return obj; // Fallback, be aware of potential issues
  }
}