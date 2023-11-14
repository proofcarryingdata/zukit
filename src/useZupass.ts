import { useContext } from "react";
import { ZupassContext, ZupassReq, ZupassState } from "./state";

export function useZupass(): [ZupassState, (request: ZupassReq) => void] {
  const val = useContext(ZupassContext);
  return [val.state, val.startReq];
}
