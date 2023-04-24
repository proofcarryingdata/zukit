import { SerializedSemaphoreGroup } from "@pcd/semaphore-group-pcd";
import { useCallback, useContext } from "react";
import { ZupassContext } from "./ZupassProvider";

export interface ZupassLoginButtonProps {
  /** Default `false`. If false, requests an identity-revealing
  login. If true, requests a Semaphore proof of anonymous membership in a group. */
  anonymous?: boolean;
  /** Default `"participants"`. Also supports `"organizers"`,
  `"residents"`, and `"visitors"`. */
  namedGroup?: "participants" | "organizers" | "residents" | "visitors";
  /** Overrides `namedGroup`, specifying a semaphore group URL. For
  example, the named participants group is equivalent to passing
  `https://api.pcd-passport.com/semaphore/1`. */
  groupURL?: string;
  /** External nullifier. This supports anonymous
  attribution. For example, you can make a poll that people can vote in
  anonymously, while ensuring that each user can only vote once. */
  externalNullifier?: bigint | string;
}

export function ZupassLoginButton({
  anonymous,
  namedGroup,
  groupURL,
  externalNullifier,
}: ZupassLoginButtonProps) {
  const { state, startReq, passportServerURL } = useContext(ZupassContext);

  const login = useCallback(async () => {
    console.log("[ZUKIT] logging in...");
    if (anonymous) {
      const url = getGroupURL(passportServerURL, namedGroup, groupURL);
      const group = await fetchGroup(url);
      startReq({
        type: "login",
        anonymous,
        group,
        groupURL: url,
        externalNullifier:
          externalNullifier == null ? undefined : "" + externalNullifier,
      });
    } else {
      startReq({ type: "login", anonymous: false });
    }
  }, [startReq, anonymous, namedGroup, groupURL, externalNullifier]);

  const logout = useCallback(() => {
    console.log("[ZUKIT] logging out...");
    startReq({ type: "logout" });
  }, [startReq]);

  switch (state.status) {
    case "logged-in":
      return <button onClick={logout}>Log out</button>;
    case "logged-out":
      const message = anonymous ? "Log in anonymously" : "Log in with Zupass";
      return <button onClick={login}>{message}</button>;
    case "logging-in":
      return <button disabled>Logging in...</button>;
  }
}

function getGroupURL(
  passportServerURL?: string,
  namedGroup?: string,
  groupURL?: string
): string {
  if (groupURL) return groupURL;

  if (!passportServerURL) throw new Error("Missing passportServerURL");
  const groups = ["participants", "residents", "visitors", "organizers"];
  const groupIx = groups.indexOf(namedGroup || "participants");
  if (groupIx < 0) throw new Error("Invalid namedGroup " + namedGroup);

  return `${passportServerURL}/semaphore/${groupIx + 1}`;
}

async function fetchGroup(groupURL: string): Promise<SerializedSemaphoreGroup> {
  const r = await fetch(groupURL);
  if (!r.ok) {
    throw new Error(`Failed to fetch ${groupURL}. Got HTTP ${r.status}`);
  }
  return r.json();
}
