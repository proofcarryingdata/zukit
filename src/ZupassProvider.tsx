import {
  fetchParticipant,
  openSignedZuzaluUUIDPopup,
  openZuzaluMembershipPopup,
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
      groupURL: string;
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

export function ZupassProvider(props: {
  children: ReactNode;
  passportServerURL?: string;
  passportClientURL?: string;
  popupURL?: string;
}) {
  const passportServerURL = url(
    props.passportServerURL,
    "passportServerURL",
    "https://api.pcd-passport.com"
  );
  const passportClientURL = url(
    props.passportClientURL,
    "passportClientURL",
    "https://zupass.org"
  );
  const defaultPopupURL =
    typeof window === "undefined"
      ? "http://localhost/popup"
      : window.location.origin + "/popup";
  const popupURL = url(props.popupURL, "popupURL", defaultPopupURL);

  function url(
    configURL: string | undefined,
    name: string,
    defaultURL: string
  ): string {
    const ret = configURL || defaultURL;
    const u = new URL(ret);
    if (!["http:", "https:"].includes(u.protocol)) {
      throw new Error("Invalid " + name);
    }
    return ret;
  }

  const [state, setState] = useState<ZupassState>(() => {
    if (typeof window === "undefined") {
      // support server-side rendering. show logged-out state.
      return { status: "logged-out" };
    }

    const json = window.localStorage["zupass"];
    console.log(`[ZUKIT] read state from localStorage: ${json}`);
    let state: ZupassState;
    try {
      state = parseAndValidate(json);
    } catch (e) {
      state = { status: "logged-out" };
    }
    writeToLocalStorage(state);
    return state;
  });

  const setAndWriteState = (newState: ZupassState) => {
    console.log(`[ZUKIT] new state ${shallowToString(newState)}`);
    setState(newState);
    writeToLocalStorage(newState);
  };

  const [pcdStr] = usePassportPopupMessages();
  React.useEffect(() => {
    if (pcdStr === "") return;

    console.log(`[ZUKIT] trying to log in with ${pcdStr.substring(0, 40)}...`);
    handleLogin(state, pcdStr, passportServerURL)
      .then((newState) => {
        if (newState) {
          setAndWriteState(newState);
        } else {
          console.log(`[ZUKIT] ${state.status}, ignoring pcd: ${pcdStr}`);
        }
      })
      .catch((e: unknown) => {
        console.error(e);
        console.error(`[ZUKIT] error logging in, ignoring pcd: ${pcdStr}`);
      });
  }, [pcdStr]);

  const startReq = React.useCallback(
    (request: ZupassReq) => {
      console.log(`[ZUKIT] startReq ${shallowToString(request)}`);
      const newState = handleLoginReq(request, passportClientURL, popupURL);
      setAndWriteState(newState);
    },
    [setAndWriteState, passportClientURL, popupURL]
  );

  const val = React.useMemo(
    () => ({ passportServerURL, state, startReq }),
    [passportServerURL, state, startReq]
  );

  return (
    <ZupassContext.Provider value={val}>
      {props.children}
    </ZupassContext.Provider>
  );
}

function writeToLocalStorage(state: ZupassState) {
  console.log(`[ZUKIT] writing to local storage, status ${state.status}`);
  window.localStorage["zupass"] = serialize(state);
}

/** Returns a `logging-in` state */
function handleLoginReq(
  request: ZupassReq,
  passportClientURL: string,
  popupURL: string
): ZupassState {
  const { type } = request;
  switch (type) {
    case "login":
      if (request.anonymous) {
        const { group, groupURL, externalNullifier } = request;
        const signal = "1"; // TODO: request.signal

        openZuzaluMembershipPopup(
          passportClientURL,
          popupURL,
          groupURL,
          "",
          signal,
          externalNullifier
        );

        return {
          status: "logging-in",
          anonymous: true,
          group,
          groupURL,
          // TODO: signal
          externalNullifier,
        };
      } else {
        openSignedZuzaluUUIDPopup(passportClientURL, popupURL, "");

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
    console.log(`[ZUKIT] ignoring message. State != logging-in: ${state}`);
    return null;
  }
  const serializedPCD = JSON.parse(pcdStr) as SerializedPCD;

  if (state.anonymous) {
    return await handleAnonLogin(
      state.groupURL,
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
  groupURL: string,
  group: SerializedSemaphoreGroup,
  externalNullifier: string | undefined,
  serializedPCD: SerializedPCD
): Promise<ZupassState | null> {
  const { type, pcd } = serializedPCD;
  if (type !== SemaphoreGroupPCDPackage.name) {
    console.log("[ZUKIT] ignoring message, wrong PCD type.");
    return null;
  }
  const groupPCD = await SemaphoreGroupPCDPackage.deserialize(pcd);

  console.log(`[ZUKIT] verifying ${groupPCD.type}`);
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
    groupURL,
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

  console.log(`[ZUKIT] verifying ${sigPCD.type}`);
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

/** Given {foo:1, bar: [1,2,...]} returns '{"foo":1,"bar":"<array>"}' */
function shallowToString(obj: any) {
  return JSON.stringify(obj, function (key: string, val: any) {
    if (key === "") return val;
    if (val == null) return null;
    if (Array.isArray(val)) return "<array>";
    if (typeof val === "object") return "<object>";
    return val;
  });
}
