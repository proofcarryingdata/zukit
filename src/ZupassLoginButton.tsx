import { ReactNode, useCallback, useContext } from "react";
import styled from "styled-components";
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
  /** Public input signal. You can use the `generateMessageHash()`
  function from `semaphore-group-pcd` to create a signal or external nullifier
  by hashing a string. */
  signal?: bigint | string;
  /** External nullifier. This supports anonymous
  attribution. For example, you can make a poll that people can vote in
  anonymously, while ensuring that each user can only vote once. */
  externalNullifier?: bigint | string;
  /** CSS class for the button. Overrides default styling. */
  className?: string;
}

export function ZupassLoginButton({
  anonymous,
  namedGroup,
  groupURL,
  signal,
  externalNullifier,
  className,
}: ZupassLoginButtonProps) {
  const { state, startReq, passportServerURL } = useContext(ZupassContext);

  const login = useCallback(async () => {
    console.log("[ZUKIT] logging in...");
    if (anonymous) {
      const url = getGroupURL(passportServerURL, namedGroup, groupURL);
      startReq({
        type: "login",
        anonymous,
        groupURL: url,
        signal: BigInt(signal == null ? 0 : signal),
        externalNullifier: BigInt(
          externalNullifier == null ? 0 : externalNullifier
        ),
      });
    } else {
      startReq({ type: "login", anonymous: false });
    }
  }, [startReq, anonymous, namedGroup, groupURL, externalNullifier]);

  const logout = useCallback(() => {
    console.log("[ZUKIT] logging out...");
    startReq({ type: "logout" });
  }, [startReq]);

  const Elem = className != null ? customButton(className) : Btn;

  switch (state.status) {
    case "logged-in": {
      const label = state.anonymous
        ? text("🕶️", "Welcome, anon")
        : text("👓", state.participant.name);
      return <Elem onClick={logout}>{label}</Elem>;
    }
    case "logged-out": {
      const label = anonymous
        ? text("🕶️", "Log in anonymously")
        : text("👓", "Log in with Zupass");
      return <Elem onClick={login}>{label}</Elem>;
    }
    case "logging-in": {
      return <Elem disabled>Logging in...</Elem>;
    }
  }
}

function customButton(className: string) {
  return function CustomBtn({ children }: { children: ReactNode }) {
    return <button className={className}>{children}</button>;
  };
}

function text(emoji: string, text: string) {
  const msp = "\u2003"; // 1em space
  return `${emoji}${msp}${text}`;
}

const Btn = styled.button`
  background: #fff;
  border-radius: 0.75rem;
  padding: 0.5rem 1rem;
  font-size: 1rem;
  cursor: pointer;
  font-weight: bold;
  box-shadow: 0px 0.25rem 0.75rem rgba(0, 0, 0, 0.1);
  border: none;
  min-width: 12rem;
  min-height: 3rem;

  &:hover {
    background: #fafafa;
  }

  &:active {
    background: #f8f8f8;
  }

  &:disabled {
    background: #f8f8f8;
    cursor: default;
  }
`;

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
