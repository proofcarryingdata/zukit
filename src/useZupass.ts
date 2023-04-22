import { useContext } from "react";
import { ZupassContext, ZupassReq } from "./ZupassProvider";
import { ZupassState } from "./state";

export function useZupass(): [ZupassState, (request: ZupassReq) => void] {
  const val = useContext(ZupassContext);
  return [val.state, val.startReq];
}
