# Deterministic visual QA

Device wrappers intentionally contain no emulator provisioning. Run each wrapper against an already booted target so screenshots reflect the requested viewport:

```sh
maestro test .maestro/devices/iphone.yaml
maestro test .maestro/devices/pixel.yaml
maestro test .maestro/devices/tablet.yaml
```

Recommended targets are an iPhone 16, Pixel 9, iPad 11-inch, and a 10-inch Android tablet. Keep font scale at 100%, locale `pt-BR`, timezone `America/Sao_Paulo`, light appearance, and animations enabled. Maestro writes captures below `.maestro/artifacts` relative to its workspace.

## Runtime integration required

The app must consume launch arguments only in a non-production visual-testing build:

- `visualTesting=true` enables the fixture transport.
- `visualScenario` is passed to `getVisualScenario` from `src/visualTesting`.
- `visualRoute` selects the fixture's initial Expo Router route.
- Auth, query/API, notifications, and profile providers must return the selected fixture instead of network or secure-storage state.
- Date-dependent UI must receive `visualClock` (fixed at `2026-06-18T12:00:00-03:00`) instead of calling the system clock.
- Add stable accessibility labels or `testID`s where localized visible text is insufficient.

Those hooks belong to providers, routing, env/config, shared UI, and features and are deliberately not changed by this package.
