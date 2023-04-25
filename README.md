<img width="630" alt="image" src="https://user-images.githubusercontent.com/169280/234023424-e88b0bba-8ea1-49f5-9bd2-411e8471a4e3.png">

```sh
npm install zukit
```

**This React library makes it easy to use the Zuzalu Passport.**

It gives you a login button similar to RainbowKit's `Connect Wallet` button.

**Supports anonymous login, where your website never learns who the user is.**
Instead, Zupass creates a zero-knowledge proof that the user is part of a set--
for example, all Zuzalu participants, or just residents or organizers--without
revealing who they are.

**<a href="https://zukit-example.vercel.app/">Live demo here.</a>**

## Reference

### `<ZupassLoginButton />`

```tsx
<ZupassLoginButton anonymous namedGroup="residents" />
```

- **`anonymous`**. Default `false`. If false, requests an identity-revealing
  login. If true, requests a Semaphore proof of anonymous membership in a group.
- **`namedGroup`**. Default `"participants"`. Also supports `"organizers"`,
  `"residents"`, and `"visitors"`.
- **`groupURL`**. Overrides `namedGroup`, specifying a semaphore group URL. For
  example, the named participants group is equivalent to passing
  `https://api.pcd-passport.com/semaphore/1`.
- **`signal`**. Public input signal. You can use the `generateMessageHash()`
  function from `semaphore-group-pcd` to create a signal or external nullifier
  by hashing a string. See
  <a href="https://semaphore.appliedzkp.org/docs/V1/howitworks">semaphore docs</a>.
- **`externalNullifier`**. External nullifier. This supports anonymous
  attribution. For example, you can make a poll that people can vote in
  anonymously, while ensuring that each user can only vote once.
- **`className`**. CSS class for the button. Overrides default styling. Button
  will be `:disabled` while logging in.

Notice that there's no callback. Instead, you can get status and loading states
from the `useZupass()` hook.

<img width="638" alt="image" src="https://user-images.githubusercontent.com/169280/234030533-fb3232a4-dfcf-4d19-9d0f-8a41b84a5137.png">

### `useZupass()`

```tsx
const [zupass] = useZupass();

if (zupass.status === "logged-in") {
  if (zupass.anonymous) return <h2>Welcome, anon</h2>;
  return <h2>Welcome, {zupass.participant.name}</h2>;
}
```

This is a React hook. The returned object contains the following.

- **`status`**. See switch statement above. All keys below are undefined if
  the status is `logged-out`.
- **`anonymous`**. True for anonymous login, false otherwise.
- **`group`**. For an anonymous login, describes the anonymity set.
- **`participant`**. For an identity-revealing login, contains user details.
- **`pcd`**. A
  <a href="https://github.com/proofcarryingdata/zupass/tree/main/packages/semaphore-group-pcd">semaphore-group-pcd</a>
  containing a nullifier hash for anonymous login, or a
  <a href="https://github.com/proofcarryingdata/zupass/tree/main/packages/semaphore-signature-pcd">semaphore-signature-pcd</a>
  containing a signature of the participant UUID for identity-revealing login.
  Either way, this PCD contains a zero-knowledge proof verifying the user.

### `<ZupassProvider>`

```tsx
export default function Page() {
  const url = "https://api.pcd-passport.com";
  return (
    <ZupassProvider passportServerUrl={url}>
      <MyApp />
    </ZupassProvider>
  );
}
```

Wrap your app in `<ZupassProvider>`. If you're using identity-revealing login,
you must include a URL to the passport server, which serves participant info.

When running the Passport locally in development, use `http://localhost:3002`.

### Popup page

```tsx
import { usePassportPopupSetup } from "@pcd/passport-interface";

export default function PassportPopup() {
  return <div>{usePassportPopupSetup()}</div>;
}
```

Finally, your app needs a `/popup` page to communicate with the passport. If
using Next, simply save the snippet above as `pages/popup.tsx`.

## Development

```sh
npm ci
npm test
```

To develop Zukit, check out
<a href="https://github.com/dcposch/zukit-example">zukit-example</a>.
