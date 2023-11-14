import { openSignedZuzaluSignInPopup } from "./vendor/SemaphoreSignatureIntegration";
import { requestUser } from "./vendor/api/requestUser";
import { useZupassPopupMessages } from "./vendor/PassportPopup";
import { SerializedPCD } from "@pcd/pcd-types";
import {
  SemaphoreGroupPCDPackage,
  SerializedSemaphoreGroup,
} from "@pcd/semaphore-group-pcd";
import { SemaphoreSignaturePCDPackage } from "@pcd/semaphore-signature-pcd";
import { Group } from "@semaphore-protocol/group";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ZupassContext,
  ZupassProviderProps,
  ZupassReq,
  ZupassState,
  parseAndValidate,
  serialize,
} from "./state";

export function ZupassProvider(props: ZupassProviderProps) {
  // Read state from local storage on page load
  const [state, setState] = useState<ZupassState>({ status: "logged-out" });
  useEffect(() => {
    readFromLocalStorage().then(setAndWriteState);
  }, []);

  // Write state to local storage whenever a login starts, succeeds, or fails
  const setAndWriteState = (newState: ZupassState) => {
    console.log(`[ZUKIT] new state ${shallowToString(newState)}`);
    setState(newState);
    writeToLocalStorage(newState);
  };

  // Configure passport
  const passportServerURL = validateURL(
    props.passportServerURL,
    "passportServerURL",
    "https://api.zupass.org"
  );
  const passportClientURL = validateURL(
    props.passportClientURL,
    "passportClientURL",
    "https://zupass.org"
  );
  const popupURL = validateURL(
    props.popupURL,
    "popupURL",
    typeof window === "undefined"
      ? "http://url.invalid"
      : window.location.origin + "/popup"
  );

  // Send login requests to passport
  const startReq = useCallback(
    (request: ZupassReq) => {
      console.log(`[ZUKIT] startReq ${shallowToString(request)}`);
      setAndWriteState(handleLoginReq(request, passportClientURL, popupURL));
    },
    [setAndWriteState, passportClientURL, popupURL]
  );

  // Receive PCDs from passport popup
  const [pcdStr] = useZupassPopupMessages();
  useEffect(() => {
    if (pcdStr === "") return;
    console.log(`[ZUKIT] trying to log in with ${pcdStr}...`);
    handleLogin(state, pcdStr, passportServerURL)
      .then((newState) => {
        if (newState) setAndWriteState(newState);
        else console.log(`[ZUKIT] ${state.status}, ignoring pcd: ${pcdStr}`);
      })
      .catch((e: unknown) => {
        console.error(e);
        console.error(`[ZUKIT] error logging in, ignoring pcd: ${pcdStr}`);
      });
  }, [pcdStr]);

  // Provide context
  const val = useMemo(
    () => ({ passportServerURL, state, startReq }),
    [passportServerURL, state, startReq]
  );

  return (
    <ZupassContext.Provider value={val}>
      {props.children}
    </ZupassContext.Provider>
  );
}

/** Reads and validates stored state. Otherwise, returns a logged-out state. */
async function readFromLocalStorage(): Promise<ZupassState> {
  const json = window.localStorage["zupass"];
  try {
    const state = await parseAndValidate(json);
    console.log(`[ZUKIT] read stored state: ${shallowToString(state)}`);
    return state;
  } catch (e) {
    console.error(`[ZUKIT] error parsing stored state: ${e}`);
    return { status: "logged-out" };
  }
}

function writeToLocalStorage(state: ZupassState) {
  console.log(`[ZUKIT] writing to local storage, status ${state.status}`);
  window.localStorage["zupass"] = serialize(state);
}

/** Pops up the passport, requesting a login. Returns a `logging-in` state */
function handleLoginReq(
  request: ZupassReq,
  passportClientURL: string,
  popupURL: string
): ZupassState {
  const { type } = request;
  switch (type) {
    case "login":
      if (request.anonymous) {
        throw new Error("Anonymous login not implemented");
      } else {
        console.log(`[ZUKIT] opening popup... ${popupURL}`);
        openSignedZuzaluSignInPopup(passportClientURL, popupURL, popupURL);
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
      await state.groupPromise,
      state.signal,
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
  signal: bigint,
  externalNullifier: bigint,
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
  if (groupPCD.claim.signal !== "" + signal) {
    throw new Error("Signal mismatch");
  }
  if (groupPCD.claim.externalNullifier !== "" + externalNullifier) {
    throw new Error("External nullifier mismatch");
  }

  return {
    status: "logged-in",
    anonymous: true,
    group,
    groupURL,
    signal,
    externalNullifier,
    serializedPCD,
    pcd: groupPCD,
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
  const signedMessage = sigPCD.claim.signedMessage;
  console.log(`[ZUKIT] verifying signed message ${signedMessage}`);
  const uuid = JSON.parse(signedMessage).uuid;
  console.log(`[ZUKIT] fetching participant ${uuid}...`);
  const participantRequest = await requestUser(passportServerUrl, uuid);
  if (!participantRequest.success) {
    if (participantRequest.error.userMissing) {
      throw new Error(`No participant with uuid ${uuid}`);
    } else {
      throw new Error(participantRequest.error.errorMessage);
    }
  }
  const participant = participantRequest.value;
  if (participant.commitment !== sigPCD.claim.identityCommitment) {
    throw new Error(`Participant commitment mismatch`);
  }
  return {
    status: "logged-in",
    anonymous: false,
    participant,
    serializedPCD,
    pcd: sigPCD,
  };
}

/** Given {foo:1, bar: [1,2,...]} returns '{"foo":1,"bar":"<array>"}' */
function shallowToString(obj: any) {
  return JSON.stringify(obj, function (key: string, val: any) {
    if (key === "") return val;
    if (val == null) return null;
    if (typeof val === "bigint") return "" + val;
    if (Array.isArray(val)) return "<array>";
    if (typeof val === "object") return "<object>";
    return val;
  });
}

/** Validates a URL config option, with fallback to a default value */
function validateURL(
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

async function fetchGroup(groupURL: string): Promise<SerializedSemaphoreGroup> {
  const r = await fetch(groupURL);
  if (!r.ok) {
    throw new Error(`Failed to fetch ${groupURL}. Got HTTP ${r.status}`);
  }
  return r.json();
}
