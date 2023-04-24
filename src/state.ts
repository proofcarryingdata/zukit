import { ZuParticipant } from "@pcd/passport-interface";
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

export type ZupassState = {
  /** Whether the user is logged in. @see ZupassLoginButton */
  status: "logged-out" | "logged-in" | "logging-in";
  /** True for anonymous login, false otherwise. */
  anonymous?: boolean;
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
      group: SerializedSemaphoreGroup;
      externalNullifier?: string;
    }
  | {
      status: "logged-in";
      anonymous: false;
      participant: ZuParticipant;
      serializedPCD: SerializedPCD<SemaphoreSignaturePCD>;
    }
  | {
      status: "logged-in";
      anonymous: true;
      groupURL: string;
      group: SerializedSemaphoreGroup;
      externalNullifier?: string;
      serializedPCD: SerializedPCD<SemaphoreGroupPCD>;
    }
);

type StateV1 = {
  version: 1;
  status: "logged-out" | "logged-in";
  anonymous?: boolean;
  participant?: ZuParticipant;
  group?: SerializedSemaphoreGroup;
  groupURL?: string;
  externalNullifier?: string;
  serializedPCD?: SerializedPCD;
};

export function parseAndValidate(json: string): ZupassState {
  const state = JSON.parse(json) as StateV1;
  if (state.version !== 1) {
    throw new Error(`Invalid state version ${state.version}`);
  }

  // Validate status
  if (!["logged-out", "logged-in"].includes(state.status)) {
    throw new Error(`Invalid status ${state.status}`);
  }

  if (state.status === "logged-out") {
    return { status: state.status };
  }

  // Parse and validate PCD and accompanying metadata.
  const {
    status,
    anonymous,
    participant,
    group,
    groupURL,
    externalNullifier,
    serializedPCD,
  } = state;
  if (anonymous == null) {
    throw new Error(`Missing anonymous flag`);
  } else if (serializedPCD == null) {
    throw new Error(`Missing serialized PCD`);
  } else if (anonymous) {
    if (group == null) {
      throw new Error(`Missing group`);
    } else if (groupURL == null) {
      throw new Error(`Missing groupURL`);
    } else if (serializedPCD.type !== SemaphoreGroupPCDPackage.name) {
      throw new Error(`Invalid PCD type ${serializedPCD.type}`);
    }
    return {
      anonymous: true,
      status,
      group,
      groupURL,
      externalNullifier,
      serializedPCD,
    };
  } else {
    if (participant == null) {
      throw new Error(`Missing participant`);
    } else if (serializedPCD.type !== SemaphoreSignaturePCDPackage.name) {
      throw new Error(`Invalid PCD type ${serializedPCD.type}`);
    }
    return { anonymous: false, status, participant, serializedPCD };
  }
}

export function serialize(state: ZupassState): string {
  const { status, anonymous } = state;
  let serState: StateV1;
  if (status === "logged-in") {
    serState = {
      version: 1,
      status,
      anonymous,
      group: anonymous ? state.group : undefined,
      groupURL: anonymous ? state.groupURL : undefined,
      participant: anonymous === false ? state.participant : undefined,
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
