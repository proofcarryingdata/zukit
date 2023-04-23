import {
  fetchParticipant,
  usePassportPopupMessages,
} from "@pcd/passport-interface";
import { SerializedPCD } from "@pcd/pcd-types";
import {
  SemaphoreGroupPCDPackage,
  SerializedSemaphoreGroup,
} from "@pcd/semaphore-group-pcd";
import { SemaphoreSignaturePCDPackage } from "@pcd/semaphore-signature-pcd";
import { Group } from "@semaphore-protocol/group";
import * as React from "react";
import { ReactNode, createContext, useState } from "react";
import { ZupassState, parseAndValidate, serialize } from "./state";

export type ZupassReq =
  | { type: "login"; anonymous: false }
  | {
      type: "login";
      anonymous: true;
      group: SerializedSemaphoreGroup;
      externalNullifier?: string;
    }
  | { type: "logout" };

export interface ZupassContextVal {
  passportServerURL?: string;
  state: ZupassState;
  startReq: (request: ZupassReq) => void;
}

export const ZupassContext = createContext<ZupassContextVal>({
  state: { status: "logged-out" },
  startReq: () => {},
});

export function ZupassProvider({
  children,
  passportServerURL,
}: {
  children: ReactNode;
  passportServerURL?: string;
}) {
  if (passportServerURL != null) {
    const url = new URL(passportServerURL);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Invalid passportServerURL");
    }
  }

  const [state, setState] = useState<ZupassState>(() => {
    if (typeof window === "undefined") {
      // support server-side rendering. show logged-out state.
      return { status: "logged-out" };
    }

    const json = window.localStorage["zupass"];
    let state: ZupassState;
    try {
      state = parseAndValidate(json);
    } catch (e) {
      state = { status: "logged-out" };
    }
    writeToLocalStorage(state);
    return state;
  });

  const [pcdStr] = usePassportPopupMessages();
  React.useEffect(() => {
    handleLogin(state, pcdStr, passportServerURL)
      .then((newState) => {
        if (newState) {
          setState(newState);
          writeToLocalStorage(newState);
        } else {
          console.log(`[ZUPASS] ${state.status}, ignoring message: ${pcdStr}`);
        }
      })
      .catch((e: unknown) => {
        console.error(e);
        console.error("[ZUPASS] Error logging in. Ignoring message", pcdStr);
      });
  });

  const startReq = React.useCallback(
    (request: ZupassReq) => {
      const newState = handleLoginReq(request);
      setState(newState);
      writeToLocalStorage(newState);
    },
    [setState]
  );

  const val = React.useMemo(
    () => ({ passportServerURL, state, startReq }),
    [passportServerURL, state, startReq]
  );

  return (
    <ZupassContext.Provider value={val}>{children}</ZupassContext.Provider>
  );
}

function writeToLocalStorage(state: ZupassState) {
  console.log(`Writing to local storage, status ${state.status}`);
  window.localStorage["zupass"] = serialize(state);
}

/** Returns a `logging-in` state */
function handleLoginReq(request: ZupassReq): ZupassState {
  const { type } = request;
  switch (type) {
    case "login":
      if (request.anonymous) {
        return {
          status: "logging-in",
          anonymous: true,
          group: request.group,
          externalNullifier: request.externalNullifier,
        };
      } else {
        return { status: "logging-in", anonymous: false };
      }
    case "logout":
      return { status: "logged-out" };
    default:
      throw new Error(`Invalid request type ${type}`);
  }
}

/** Returns either a `logged-in` state, null to ignore, or throws on error. */
async function handleLogin(
  state: ZupassState,
  pcdStr: string,
  passportServerURL?: string
): Promise<ZupassState | null> {
  if (state.status !== "logging-in") {
    console.log(`[ZUPASS] Ignorting message. State != logging-in: ${state}`);
    return null;
  }
  const serializedPCD = JSON.parse(pcdStr) as SerializedPCD;

  if (state.anonymous) {
    return await handleAnonLogin(
      state.group,
      state.externalNullifier,
      serializedPCD
    );
  } else {
    if (passportServerURL == null) {
      throw new Error("passportServerURL not set");
    }
    return await handleIdentityRevealingLogin(serializedPCD, passportServerURL);
  }
}

async function handleAnonLogin(
  group: SerializedSemaphoreGroup,
  externalNullifier: string | undefined,
  serializedPCD: SerializedPCD
): Promise<ZupassState | null> {
  const { type, pcd } = serializedPCD;
  if (type !== SemaphoreGroupPCDPackage.name) {
    console.log("Ignoring message, wrong PCD type.");
    return null;
  }
  const groupPCD = await SemaphoreGroupPCDPackage.deserialize(pcd);
  if (!(await SemaphoreGroupPCDPackage.verify(groupPCD))) {
    throw new Error("Invalid proof");
  }

  // TODO: simplify SerializedSemaphoreGroup to include merkle root
  const semaGroup = new Group(1, 16);
  semaGroup.addMembers(group.members);
  if (BigInt(groupPCD.claim.merkleRoot) !== BigInt(semaGroup.root)) {
    throw new Error("Group Merkle root mismatch");
  }
  if (groupPCD.claim.externalNullifier !== (externalNullifier || "")) {
    throw new Error("External nullifier mismatch");
  }

  return {
    status: "logged-in",
    anonymous: true,
    group,
    serializedPCD,
  };
}

async function handleIdentityRevealingLogin(
  serializedPCD: SerializedPCD,
  passportServerUrl: string
): Promise<ZupassState | null> {
  const { type, pcd } = serializedPCD;
  if (type !== SemaphoreSignaturePCDPackage.name) {
    throw new Error(`Wrong PCD type: ${type}`);
  }
  const sigPCD = await SemaphoreSignaturePCDPackage.deserialize(pcd);
  if (!(await SemaphoreSignaturePCDPackage.verify(sigPCD))) {
    throw new Error("Invalid signature");
  }
  const uuid = sigPCD.claim.signedMessage;
  const participant = await fetchParticipant(passportServerUrl, uuid);
  if (!participant) {
    throw new Error(`No participant with uuid ${uuid}`);
  } else if (participant.commitment !== sigPCD.claim.identityCommitment) {
    throw new Error(`Participant commitment mismatch`);
  }
  return {
    status: "logged-in",
    anonymous: false,
    participant,
    serializedPCD,
  };
}
