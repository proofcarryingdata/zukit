```
npm install zukit
```

**This React library makes it easy to use the Zuzalu Passport.**

It gives you a `Login with Zupass` button similar to RainbowKit's
`Connect Wallet` button.

**Supports anonymous login, where your website never learns who the user is.**
Instead, Zupass creates a zero-knowledge proof that the user is part of a set--
for example, all Zuzalu participants, or just residents or organizers--without
revealing who they are.

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
- **`externalNullifier`**. External nullifier. This supports anonymous
  attribution. For example, you can make a poll that people can vote in
  anonymously, while ensuring that each user can only vote once.

Notice that there's no callback. Instead, you can get status and loading states
from the `useZupass()` hook.

### `useZupass()`

```tsx
const [zupass] = useZupass();

switch (zupass.status) {
  case "logged-out":
    return <h2>Use the button above to log in</h2>;
  case "logging-in":
    return <h2>Logging in...</h2>;
  case "logged-in":
    return <h2>Welcome, anon</h2>;
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

## Development

```
npm ci
npm test
```

To see it in use, check out
<a href="https://github.com/dcposch/zukit-example">zukit-example</a>.

To develop Zukit, check out the example repo. Then,

```
cd zukit
npm i
npm link
cd node_modules/react
npm link
npm run dev
```

Finally,

```
cd zukit-example
npm i
npm link zukit react
npm run dev
```
