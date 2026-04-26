import type { TimestampedValue } from "../values/TimestampedValue.js";

export interface Historizable<T> {
  history(): readonly TimestampedValue<T>[];
}
