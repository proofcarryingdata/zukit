import { ZupassUserJson as User } from "./vendor/api/requestTypes";
import { SerializedPCD } from "@pcd/pcd-types";
import {
  SemaphoreGroupPCD,
  SemaphoreGroupPCDPackage,
  SerializedSemaphoreGroup,
} from "@pcd/semaphore-group-pcd";
import {
  SemaphoreSignaturePCD,
  SemaphoreSignaturePCDPackage,
} from "@pcd/semaphore-signature-pcd";
import { ReactNode, createContext } from "react";

export type ZupassState = {
  /** Whether the user is logged in. @see ZupassLoginButton */
  status: "logged-out" | "logged-in" | "logging-in";
} & (
  | {
      status: "logged-out";
    }
  | {
      status: "logging-in";
      anonymous: false;
    }
  | {
      status: "logging-in";
      anonymous: true;
      groupURL: string;
      groupPromise: Promise<SerializedSemaphoreGroup>;
      signal: bigint;
      externalNullifier: bigint;
    }
  | {
      status: "logged-in";
      anonymous: false;
      participant: User;
      serializedPCD: SerializedPCD<SemaphoreSignaturePCD>;
      pcd: SemaphoreSignaturePCD;
    }
  | {
      status: "logged-in";
      anonymous: true;
      groupURL: string;
      group: SerializedSemaphoreGroup;
      signal: bigint;
      externalNullifier: bigint;
      serializedPCD: SerializedPCD<SemaphoreGroupPCD>;
      pcd: SemaphoreGroupPCD;
    }
);

type StateV1 = {
  version: 1;
  status: "logged-out" | "logged-in";
  anonymous?: boolean;
  participant?: User;
  group?: SerializedSemaphoreGroup;
  groupURL?: string;
  signal?: string;
  externalNullifier?: string;
  serializedPCD?: SerializedPCD;
};

export async function parseAndValidate(json?: string): Promise<ZupassState> {
  if (json == null || json.trim() === "") {
    return { status: "logged-out" };
  }

  const stored = JSON.parse(json) as StateV1;
  if (stored.version !== 1) {
    throw new Error(`Invalid state version ${stored.version}`);
  }

  // Validate status
  if (!["logged-out", "logged-in"].includes(stored.status)) {
    throw new Error(`Invalid status ${stored.status}`);
  }

  if (stored.status === "logged-out") {
    return { status: stored.status };
  }

  // Parse and validate PCD and accompanying metadata.
  const {
    status,
    anonymous,
    participant,
    group,
    groupURL,
    signal,
    externalNullifier,
    serializedPCD,
  } = stored;
  if (anonymous == null) {
    throw new Error(`Missing anonymous flag`);
  } else if (serializedPCD == null) {
    throw new Error(`Missing serialized PCD`);
  } else if (anonymous) {
    if (group == null) throw new Error(`Missing group`);
    else if (groupURL == null) throw new Error(`Missing groupURL`);
    else if (signal == null) throw new Error(`Missing signal`);
    else if (externalNullifier == null) {
      throw new Error(`Missing externalNullifier`);
    } else if (serializedPCD.type !== SemaphoreGroupPCDPackage.name) {
      throw new Error(`Invalid PCD type ${serializedPCD.type}`);
    }

    return {
      anonymous: true,
      status,
      group,
      groupURL,
      signal: BigInt(signal),
      externalNullifier: BigInt(externalNullifier),
      serializedPCD,
      pcd: await SemaphoreGroupPCDPackage.deserialize(serializedPCD.pcd),
    };
  } else {
    if (participant == null) {
      throw new Error(`Missing participant`);
    } else if (serializedPCD.type !== SemaphoreSignaturePCDPackage.name) {
      throw new Error(`Invalid PCD type ${serializedPCD.type}`);
    }
    return {
      anonymous: false,
      status,
      participant,
      serializedPCD,
      pcd: await SemaphoreSignaturePCDPackage.deserialize(serializedPCD.pcd),
    };
  }
}

export function serialize(state: ZupassState): string {
  const { status } = state;
  let serState: StateV1;
  if (status === "logged-in") {
    const { anonymous } = state;
    serState = {
      version: 1,
      status,
      anonymous,
      group: anonymous ? state.group : undefined,
      groupURL: anonymous ? state.groupURL : undefined,
      signal: anonymous ? "" + state.signal : undefined,
      externalNullifier: anonymous ? "" + state.externalNullifier : undefined,
      participant: anonymous ? undefined : state.participant,
      serializedPCD: state.serializedPCD,
    };
  } else {
    serState = {
      version: 1,
      status: "logged-out",
    };
  }
  return JSON.stringify(serState);
}

export type ZupassReq =
  | { type: "login"; anonymous: false }
  | {
      type: "login";
      anonymous: true;
      groupURL: string;
      signal: bigint;
      externalNullifier: bigint;
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

export interface ZupassProviderProps {
  children: ReactNode;
  /** Passport API server, for loading participants and semaphore groups */
  passportServerURL?: string;
  /** Passport UI, for requesting proofs */
  passportClientURL?: string;
  /** Local app popup URL. Redirects to passport, returns resulting PCD. */
  popupURL?: string;
}
