import type { Objective } from "../values/Objective.js";

export interface HasObjective<T> {
  objective(): Objective<T>;
}
