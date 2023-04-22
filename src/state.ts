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
  status: "logged-out" | "logged-in" | "logging-in" | "logging-out";
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
      group: SerializedSemaphoreGroup;
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
      group: SerializedSemaphoreGroup;
      serializedPCD: SerializedPCD<SemaphoreGroupPCD>;
    }
);

type StateV1 = {
  version: 1;
  status: "logged-out" | "logged-in" | "logging-in";
  anonymous?: boolean;
  participant?: ZuParticipant;
  group?: SerializedSemaphoreGroup;
  serializedPCD?: SerializedPCD;
};

export function parseAndValidate(json: string): ZupassState {
  const state = JSON.parse(json) as StateV1;
  if (state.version !== 1) {
    throw new Error(`Invalid state version ${state.version}`);
  }

  // Validate status
  if (
    !["logged-out", "logged-in", "logging-in", "logging-out"].includes(
      state.status
    )
  ) {
    throw new Error(`Invalid status ${state.status}`);
  }

  if (state.status === "logged-out") {
    return { status: state.status };
  }

  // Validate in-progress login.
  const { status, anonymous, participant, group, serializedPCD } = state;
  if (anonymous == null) {
    throw new Error(`Missing anonymous flag`);
  }
  if (status === "logging-in") {
    if (anonymous) {
      if (group == null) {
        throw new Error(`Missing group`);
      }
      return { status, anonymous, group };
    } else {
      return { status, anonymous: false };
    }
  }

  // Parse and validate PCD and accompanying metadata.
  if (serializedPCD == null) {
    throw new Error(`Missing serialized PCD`);
  } else if (anonymous) {
    if (group == null) {
      throw new Error(`Missing group`);
    } else if (serializedPCD.type !== SemaphoreGroupPCDPackage.name) {
      throw new Error(`Invalid PCD type ${serializedPCD.type}`);
    }
    return { anonymous: true, status, group, serializedPCD };
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
      participant: anonymous === false ? state.participant : undefined,
      serializedPCD: state.serializedPCD,
    };
  } else {
    serState = {
      version: 1,
      status,
      anonymous,
    };
  }
  return JSON.stringify(serState);
}
