import type { ContributesToParent } from "./ContributesToParent.js";
import type { HasObjective } from "./HasObjective.js";
import type { Historizable } from "./Historizable.js";

function isObjectLike(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

export function implementsHistorizable<T = unknown>(x: unknown): x is Historizable<T> {
  return isObjectLike(x) && typeof x.history === "function";
}

export function implementsHasObjective<T = unknown>(x: unknown): x is HasObjective<T> {
  return isObjectLike(x) && typeof x.objective === "function";
}

export function implementsContributesToParent<T = unknown>(
  x: unknown,
): x is ContributesToParent<T> {
  return (
    isObjectLike(x) &&
    typeof x.isEligible === "function" &&
    typeof x.contribution === "function"
  );
}
