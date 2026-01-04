import path from "path";
import { DATA_DIR } from "./paths";

export function callPath(id: string) {
  return path.join(DATA_DIR, `call-${id}.json`);
}

export function orderPath(id: string) {
  return path.join(DATA_DIR, `order-${id}.json`);
}

