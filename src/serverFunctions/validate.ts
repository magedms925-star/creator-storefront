import type { z } from "zod";

/** Parses input, throwing the first problem as a sentence the page can show. */
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? "Check the form and try again.");
  return result.data;
}
