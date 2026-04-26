import type { TimestampedValue } from "../values/TimestampedValue.js";

export interface ContributesToParent<T> {
  isEligible(): boolean;
  contribution(): TimestampedValue<T>;
}
