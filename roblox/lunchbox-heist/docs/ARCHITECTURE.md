# Lunchbox Heist – Architecture & contracts

Roblox game (Luau, Rojo project). "Steal-and-defend" tycoon with an original theme: a conveyor belt of
**lunchboxes**; buy them, **warm** them on your plot's shelves, they reveal a **mutation** and earn cash/second;
other players can **steal** ready boxes from your plot unless your base is **locked**; cash buys better boxes;
**rebirth** for a permanent multiplier. Monetisation: game passes + developer products (fair, no pay-to-win
exclusives; odds are disclosed in the Info panel).

Everything is built **in code** (no Studio-made assets): map, boxes and UI are generated at runtime.

## Layout

```
src/shared/   (ReplicatedStorage.Shared)   Config, Types, Economy (pure math), Util, Signal, Remotes
src/server/   (ServerScriptService.Server) init.server.luau + Services/*
src/client/   (StarterPlayerScripts.Client) init.client.luau, ClientState, UIKit, Controllers/*
tools/        check.sh (type-check+lint), gen_sourcemap.py   tests/run.py (unit tests)
```

## Hard rules (every file)

1. `--!strict` at the top. The code MUST pass `./tools/check.sh` with **zero errors and zero warnings**
   (`LocalUnused`, `UnknownGlobal`, ... count). Run it often. Also keep `stylua`-style formatting (tabs).
2. Requires use static paths so types flow: `require(ReplicatedStorage.Shared.Config)`. Services never
   `require` each other; they use the `services` table passed to `init(services)` (see below).
3. **Server is authoritative.** Never trust any remote argument: validate types (`typeof`), ranges, ownership,
   cooldowns, distance, and state. Clients only *request*; the server decides. No client-provided prices,
   amounts, ids, or positions are used without validation. Rate-limit every remote.
4. Never yield inside `init`. Long-running work goes in `start` (spawned) or in event handlers.
5. Persistent timestamps use `os.time()` (unix seconds). Snapshot timestamps sent to clients are also
   `os.time()`-based unix seconds; clients compare with `workspace:GetServerTimeNow()`.
6. Cash is a Lua number (double). Always go through `EconomyService.addCash/spendCash`; never write
   `data.cash` directly anywhere else. Guard against NaN/inf/negative amounts.
7. Every Instance created for a player is destroyed when they leave (no leaks); connections are cleaned up.
8. No `wait()`/`spawn()`/`delay()`; use `task.wait/spawn/delay`. No deprecated APIs.
9. Use `--` comments sparingly: explain *why*, not *what*.

## Service interface

Each server module returns a table:
```lua
return {
    Name = "XService",
    init = function(services: { [string]: any }) end,  -- store `services`, create state/connections; NO yielding
    start = function() end,                            -- optional; may yield (runs in its own thread)
    -- ...public API below
}
```
`init.server.luau` loads services in this order: DataService, WorldService, MonetizationService, BoxService,
StealService, EventService, EconomyService. All `init` run before any `start`. In `init(services)` keep the table
and call other services lazily (inside functions) via `services.BoxService.foo(...)`.
Use `local S: { [string]: any } = {}` and `S = services`. Type the public API through
explicit function annotations; calls through `services` are `any`.

## Remotes (see Config.Remotes, created by Remotes.init())

| Name | Dir | Args | Notes |
|---|---|---|---|
| StateUpdate | S→C | `Types.StateSnapshot` | full snapshot; EconomyService only |
| Toast | S→C | `kind: "info"\|"good"\|"bad"\|"steal"`, `text: string` | |
| Announce | S→C | `text: string`, `seconds: number` | big banner |
| BonkFeedback | S→C | `"hit"\|"miss"\|"cooldown"` | |
| RequestState | C→S | – | server replies with StateUpdate |
| RequestRebirth | C→S | – | EconomyService validates cost |
| RequestFreeLock | C→S | – | StealService |
| ClaimDaily | C→S | – | EventService |
| RequestHome | C→S | – | WorldService teleports to own plot |
| Bonk | C→S | `targetUserId: number` | StealService validates range/cooldown |

Clients prompt purchases themselves with `MarketplaceService:PromptGamePassPurchase(player, id)` /
`PromptProductPurchase`; the server grants only via `PromptGamePassPurchaseFinished` + `ProcessReceipt`.

## Data model

See `src/shared/Types.luau` (`PlayerData`, `BoxData`, `StateSnapshot`, `Plot`, `Slot`).
Box lifecycle: **belt** (physical, `Config.Tags.BeltBox`) → bought → `BoxData{state="warming", mutation rolled
now, warmEndsAt}` placed in a free slot → when `os.time() >= warmEndsAt` becomes `"ready"` (reveal animation,
earns income, gets a **Dish** model tagged `Config.Tags.Dish` with attributes `OwnerUserId` + `BoxId`) →
may be stolen (`inTransit`) → delivered to the thief's `DeliveryPad` (ownership moves) or returned.

## Public APIs (exact names/signatures — implement exactly, other services call them)

### DataService (src/server/Services/DataService.luau)
```lua
Loaded: Signal        -- :Fire(player)   after the profile is ready and cached (not fired on failure)
Removing: Signal      -- :Fire(player)   BEFORE the final save+release (services finalise state here)
get(player: Player): Types.PlayerData?     -- nil until loaded / after release
isLoaded(player: Player): boolean
markDirty(player: Player)                  -- schedule save (autosave handles it)
saveNow(player: Player): boolean           -- yields; true if the write succeeded
hasReceipt(player: Player, purchaseId: string): boolean
addReceipt(player: Player, purchaseId: string)   -- trims to Config.Data.MaxReceiptHistory
```
Behaviour: `DataStoreService:GetDataStore(Config.Data.StoreName)`, key `KeyPrefix..UserId`; session locking via a
`lock = {jobId, time}` field written with `UpdateAsync` (steal a lock older than `LockTimeoutSeconds`; retry with
back-off if another live server holds it; kick the player with a clear message if it can't be acquired after a few
tries); `Util.reconcile` over a default template (`Config.Start.Cash`, empty boxes, etc.) + schema migration hook by
`version`; autosave every `AutosaveSeconds` for dirty profiles (staggered); save on leave; `game:BindToClose`
saves everyone in parallel (with a time budget) — `RunService:IsStudio()` or API-services-disabled → in-memory
fallback with a `warn` (game must still work in unpublished Studio). All DataStore calls wrapped in `pcall` with retry.
New profile → `protectedUntil = os.time() + Config.Steal.NewPlayerProtection`. Never lose data if a call fails
(keep the cached profile and retry). `lastSeen` updated on save.

### WorldService (src/server/Services/WorldService.luau)
```lua
PlotClaimed: Signal   -- :Fire(player, plot)
PlotReleased: Signal  -- :Fire(player, plot)
build()                                       -- called from init(); builds everything below under workspace
getPlots(): { Types.Plot }
getPlot(player: Player): Types.Plot?          -- plot owned by player
getPlotByOwnerId(userId: number): Types.Plot?
claimPlot(player: Player): Types.Plot?        -- nil if all 8 are taken; also called automatically on PlayerAdded
releasePlot(player: Player)                   -- also automatic on PlayerRemoving
setSlotsUnlocked(plot: Types.Plot, count: number)   -- slots 1..count unlocked, rest show a locked sign
setPlotLocked(plot: Types.Plot, locked: boolean)    -- shows/hides Shield (translucent bubble) + sign text "LOCKED"
teleportToPlot(player: Player)                -- moves the character to plot.SpawnCFrame (safe if no character)
getBeltPath(): { Vector3 }                    -- waypoints from belt start to belt end (end = despawn point)
getSlotCFrame(plot: Types.Plot, slotIndex: number): CFrame   -- where a box model sits (on top of Pad)
```
Map (procedural, tasteful, brand colours orange/green/cream, lit, no gaps to fall through): big base area,
a long central **conveyor** (visually moving belt via an animated texture or segment parts) with gutters, two rows of
4 **plots** (8 total) facing the belt, each plot has `Config.Plots.MaxSlots` slot pads on shelves in a readable
grid, a **DeliveryPad** (glowing, labelled "DELIVER HERE"), owner sign (SurfaceGui with display name), spawn point,
and a low fence/wall so thieves enter via a gate-like opening at the belt side. Players spawn on their plot
(`Players.RespawnTime = 3`, a `SpawnLocation` per plot with `Neutral = false`, assigned via `player.RespawnLocation`).
Add a central lobby sign and decoration (trees, lamps) from simple Parts. Set `Lighting` (ClockTime 14, soft Atmosphere),
disable the default baseplate. Keep Part count modest (< 2500) and `Anchored = true` everywhere; `CanQuery/CanTouch`
off for decoration. Everything parented to `workspace.LunchboxHeistMap` (Folder/Model).

### MonetizationService (src/server/Services/MonetizationService.luau)
```lua
PassChanged: Signal    -- :Fire(player, passKey, owned)
hasPass(player: Player, key: string): boolean        -- keys from Config.Passes
isPremium(player: Player): boolean                    -- MembershipType == Premium
getPersonalLuck(player: Player): number               -- pass (1.5) * active Luck Potion (2); >= 1
getWarmFactor(player: Player): boolean                -- true if FastWarm pass owned (Economy.warmSeconds(kind, true))
getSlotCount(player: Player): number                  -- Economy.slotCount(hasPass ExtraSlots)
```
Game passes: ownership via `MarketplaceService:UserOwnsGamePassAsync` (pcall + cache per player, retry), refreshed on
`PromptGamePassPurchaseFinished(player, id, wasPurchased)`; passes with Id==0 are "not created yet" and never owned — except in Studio
(`RunService:IsStudio()` and `Config.Monetization.StudioTestMode`) when the Workspace attribute `LH_DevGrantAllPasses` is `true` (developer sets it by hand
in Studio; documented in docs/SETUP.md): then every pass counts as owned. This can never affect a live server. Developer products: **one** `MarketplaceService.ProcessReceipt` assignment (this module only),
handler table by product Key (`Config.Products[i].Id` ↔ key): `CashSmall/Medium/Large` → `EconomyService.addCash(player,
Economy.cashPackAmount(key, EconomyService.getIncomePerSecond(player)), "product")`; `SkipWarm` → `BoxService.skipAllWarming(player)`;
`Lock60` → `StealService.addLock(player, Config.Steal.ProductLockSeconds, true)`; `LuckPotion` → `data.luckUntil = max(now, luckUntil) + Config.LuckPotionSeconds`.
ProcessReceipt MUST be idempotent and safe: wait (bounded) for the player's profile; if `DataService.hasReceipt(player, PurchaseId)`
return PurchaseGranted; apply grant; `addReceipt`; `DataService.saveNow` (if save fails return `NotProcessedYet`); unknown product →
`NotProcessedYet`; player left → `NotProcessedYet`. Toast the player. For testing without real ids there is a **server-only** function
`studioGrantProduct(player: Player, key: string): boolean` (does nothing unless `RunService:IsStudio()`; never exposed through a remote) that runs the same grant
handler as a purchase; document in docs/SETUP.md how to call it from the Studio command bar.
Calls `EconomyService.pushState(player)` after changes. Premium: also `isPremium` (income bonus applied by EconomyService).

### BoxService (src/server/Services/BoxService.luau)
Conveyor + plot boxes + warm/reveal + visuals + purchase.
```lua
getBoxes(player: Player): { Types.BoxData }
findBox(player: Player, boxId: string): Types.BoxData?
getFreeSlot(player: Player): number?                   -- lowest free unlocked slot index
getBaseIncomePerSecond(player: Player): number         -- sum Economy.boxBaseIncome of ready, not-inTransit boxes (NOT multiplied)
getUsedSlots(player: Player): number
skipAllWarming(player: Player): number                 -- instantly finish warming; returns how many
addBox(player: Player, box: Types.BoxData): boolean    -- places into box.slot (or free slot if taken/0), builds visuals; false if no space
beginTransit(owner: Player, boxId: string): Types.BoxData?   -- marks inTransit=true, hides Dish; nil unless ready & not already inTransit
cancelTransit(owner: Player, boxId: string)             -- inTransit=false, Dish restored in its slot
completeTransit(owner: Player, boxId: string): Types.BoxData?  -- removes the box from owner data permanently, returns it (state kept)
refreshPlayer(player: Player)                          -- rebuild all visuals for the player's plot from data
DishAdded/…: use CollectionService tag instead (see below)
```
Belt: every `Config.Belt.SpawnInterval` spawn (if < MaxOnBelt) a belt box. The belt is shared by everyone, so the **kind** is rolled with the
server-wide event luck only: `Economy.rollKind(EventService.getLuckMultiplier(), rng)`. **Personal** luck (Lucky Boxes pass x Luck Potion x event luck,
= `EconomyService.getLuck(player)`) applies to the **mutation** roll at purchase: `Economy.rollMutation(luck, rng)`. Belt boxes move along
`WorldService.getBeltPath()` at `Config.Belt.Speed`, are `Anchored` and moved via CFrame each Heartbeat (one loop for all), despawn at the path end, are
tagged `Config.Tags.BeltBox` with a `BeltId` attribute, show a BillboardGui (name, rarity colour, price) and a `ProximityPrompt` ("Buy"; HoldDuration 0.3; distance ~10).
Purchase (server, on `Triggered(player)`): validate belt box still exists and not already claimed (claim flag set first → no double
buys), player profile loaded & has plot, free slot, `EconomyService.spendCash(player, price)` succeeds (refund if later steps fail),
then create `BoxData` (mutation rolled with luck, warmEndsAt = now + `Economy.warmSeconds(kind, MonetizationService.getWarmFactor(player))`),
remove the belt box, place on the plot slot with a satisfying pop animation (TweenService) + sound-free particles, Toast. Warming
boxes show a countdown BillboardGui + a closed/pulsing lunchbox; at ready: reveal tween + mutation label/colour, spawn Dish
tag. A single server Heartbeat/1s loop promotes warming→ready (also on load for offline time, silently if `warmEndsAt` passed).
Lunchbox model: built from Parts (body, lid, handle, latch, colour per kind, glow ring for mutation) — attractive, < 12 parts.
On `DataService.Loaded` + plot claimed → `refreshPlayer`. On player removal → destroy their box models. Respect `inTransit`:
on load, clear any stale `inTransit` flags. `PassChanged(ExtraSlots)` → `WorldService.setSlotsUnlocked`. Always
`DataService.markDirty` after mutations and `EconomyService.pushState(player)` when counts change.

### StealService (src/server/Services/StealService.luau)
Stealing, carrying, delivery, base locks, spawn protection, bonk.
```lua
isLocked(player: Player): boolean                      -- base lock or spawn protection active
getLockUntil(player: Player): number                   -- os.time() end of the longest of lock/protection (<= now: none)
addLock(player: Player, seconds: number, stack: boolean?): ()   -- stack adds to remaining, capped at MaxLockSeconds from now
claimFreeLock(player: Player): (boolean, string?)      -- uses data.freeLockReadyAt cooldown
isCarrying(player: Player): boolean
getCarry(player: Player): Types.CarryInfo?
dropCarry(player: Player, reason: string)              -- box returns to the owner (BoxService.cancelTransit)
```
Steal flow: StealService listens to `CollectionService:GetInstanceAddedSignal(Config.Tags.Dish)` (+ existing tagged) and attaches a
`ProximityPrompt` ("Steal", `HoldDuration = Config.Steal.HoldDuration`, `RequiresLineOfSight = false`, MaxActivationDistance
`PromptDistance`), **enabled only for non-owners** — implement by `PromptShown`/server check: prompt is created `Enabled=true` and the
server re-validates everything in `Triggered`/`PromptButtonHoldEnded`. On `Triggered(thief)`: validate thief has plot + loaded + not carrying +
alive; owner is a loaded player in this server, not the thief, not `isLocked(owner)`; box is ready & not inTransit; thief distance to
dish < PromptDistance + slack (server check on HumanoidRootPart). Then `BoxService.beginTransit(owner, boxId)`; attach a carried model to
the thief's character (Weld to hand/upper torso; tiny glow + billboard "STOLEN <kind>"), slow them (`WalkSpeed * CarrySpeedFactor`, restore on end),
Toast both sides (owner gets "X is stealing your Y! Bonk them!"), send `StateUpdate` via EconomyService.pushState. **Delivery**: thief touches own
`plot.DeliveryPad` (server `Touched` + distance/validity check or a ProximityPrompt on the pad; choose the robust one) within
`CarryTimeout` → `BoxService.completeTransit(owner, boxId)` then `BoxService.addBox(thief, box)` (if no free slot → box returns to owner,
Toast "No free slot!"); stats `steals/timesStolen`; `DataService.markDirty` both; `DataService.saveNow` for **both** (yielding in a spawned thread) so a crash can't duplicate/lose.
**Cancel/return** (`BoxService.cancelTransit`) when: thief dies, thief leaves (hook `DataService.Removing`/`PlayerRemoving`), owner leaves
(box vanishes from thief hands; ensure the owner's data keeps it — it was never removed), timeout, or bonk hit while carrying
(`Config.Steal.BonkDropsCarry`). Exactly-once guarantee: a box is either in the owner's `boxes` (maybe `inTransit`) or in the thief's — never both,
never neither; use a per-box state machine and make every transition idempotent.
Locks: `data` has no lock field — keep `lockUntil[userId]` in memory (os.time based) PLUS spawn protection from `data.protectedUntil`
(persistent). Free lock: `claimFreeLock` (cooldown `FreeLockCooldown`, sets `data.freeLockReadyAt`, adds `FreeLockSeconds`). Toast on expiry.
`WorldService.setPlotLocked(plot, locked)` while locked. **Bonk**: all players get a "Bonk" `Tool` (re-granted on respawn via StarterGear-like logic
on CharacterAdded) with no client trust: client fires `Bonk(targetUserId)` on `Tool.Activated`; server validates: sender has the tool equipped, alive,
`typeof(targetUserId)=="number"`, target is another player's alive character within `Config.Steal.BonkRange` (server-side distance),
cooldown `BonkCooldown` per player → target stunned (`PlatformStand`/WalkSpeed 0 for `StunSeconds`, then restored — no permanent changes!),
and if carrying and `BonkDropsCarry` → `dropCarry`. Reply `BonkFeedback`. No extra restrictions beyond the ones above.
Ensure `Humanoid.WalkSpeed` changes compose (carry slow + stun) and always restore on character death/respawn.

### EventService (src/server/Services/EventService.luau)
```lua
getLuckMultiplier(): number            -- active server event luck (>= 1)
getCashMultiplier(): number            -- active server event cash mult (>= 1)
getActiveEvent(): Types.EventInfo?
getDailyState(player: Player): Types.DailyState
claimDaily(player: Player): (boolean, string?)
```
Server events: every `Config.Events.IntervalSeconds` pick the next from `Config.Events.List` (round-robin/random, deterministic order ok),
run for `DurationSeconds`, broadcast `Announce` (start/end) and call `EconomyService.pushStateAll()`. `EventInfo.endsAt` is `os.time()`-based.
Daily: day number = `os.time() // 86400`; streak continues if last claim was yesterday, resets if older, can't claim twice a day; reward from
`Config.Daily.Rewards[Economy.dailyDayIndex(newStreak)]` → `EconomyService.addCash(player, reward.Cash, "daily")` and
`StealService.addLock(player, reward.LockSeconds, true)` when > 0. Remote `ClaimDaily` handler with a rate limit + Toast result.
New players: first time only, show nothing special.

### EconomyService (src/server/Services/EconomyService.luau)
```lua
getCash(player: Player): number
addCash(player: Player, amount: number, reason: string?): ()      -- amount must be finite and > 0 else ignored (warn)
spendCash(player: Player, amount: number): boolean                -- amount finite > 0, atomically checks balance
getMultiplier(player: Player): number                              -- Economy.totalMultiplier(...) incl. event cash
getIncomePerSecond(player: Player): number                         -- BoxService.getBaseIncomePerSecond * getMultiplier
getLuck(player: Player): number                                    -- personal luck * event luck (for UI)
canRebirth(player: Player): (boolean, string?)
rebirth(player: Player): (boolean, string?)                        -- validates cost + Max; resets cash to Config.Start.Cash and boxes to {} (keeps rebirths+1, stats, passes)
buildSnapshot(player: Player): Types.StateSnapshot?
pushState(player: Player)                                          -- debounced (~0.15s) StateUpdate to that player
pushStateAll()
```
Income tick: every 1s for every loaded player `addCash(player, getIncomePerSecond(player))` (tracks `totalEarned`). Leaderstats folder `leaderstats` with
`Cash` (formatted via `Util.formatCash` in a StringValue? — use IntValue for `Rebirths` and a StringValue for Cash text; keep a hidden NumberValue if useful).
Offline "welcome back": on `DataService.Loaded` (after boxes loaded) compute `Economy.offlineEarnings(incomePerSecond, now - data.lastSeen)` and grant + Toast.
Rebirth: `RequestRebirth` remote (rate limited, 2s), destroys the player's box models (via `BoxService.refreshPlayer` after data reset), Toast + Announce.
Handles `RequestState` (send snapshot). `data.cash` is only ever mutated here. Clamp cash to `1e15` to avoid float explosions? (cap at 1e18; document).

## Client (src/client)

`init.client.luau` (already written) starts controllers in order: Toast, Hud, Carry, Shop, Info, Rebirth, Daily, Bonk.
Each `Controllers/XController.luau` returns `{ start = function() end }`. Shared helpers: `UIKit` and `ClientState` (already written; read them
first; extend UIKit only by adding functions, never changing existing signatures). Look & feel: friendly, chunky, rounded, brand orange/green on cream/ink,
large tap targets (min 44px), readable on phones, `UIScale`/constraints, no overlap between HUD elements at 360×640 and 1920×1080, tweened feedback.
No external asset ids (no images/sounds that can fail to load) — use text, emoji-free shapes (UI strokes, gradients). `ClientState.get()` has the snapshot.

- **ToastController**: `Remotes.Toast` stack (max 4, auto fade 3.5s, colours by kind) + `Remotes.Announce` banner (top-centre, big). Exposes nothing.
- **HudController**: top-left cash (animated count-up via tween of a displayed number, `Util.formatCash`) + "/s" income + rebirth count; bottom-left buttons
  (🏠 Home → `RequestHome`, 🛒 Shop, ℹ Info, ♻ Rebirth, 🎁 Daily, 🔒 Free Lock with cooldown text) as compact icon-text buttons; lock/protection status chip
  with live countdown; event chip (name + countdown + multipliers) when `snapshot.event`; luck chip. Uses a single RenderStepped/Heartbeat-free 0.25s timer for countdowns.
  Panels are opened through a tiny registry module `Controllers/Panels.luau` (written by the client-core agent):
  `Panels.register(name: string, open: () -> ())`, `Panels.open(name: string)`, `Panels.toggle(name)`. Other controllers register
  `"Shop"`, `"Info"`, `"Rebirth"`, `"Daily"` in their `start()`; the Hud buttons call `Panels.open("Shop")` etc. (no-op if not registered yet).
- **CarryController**: when `snapshot.carrying` is set: top-centre banner "Deliver to your base! 0:42" with a progress bar + a 3D guide arrow/beam: a `Beam`/`Highlight`
  to the player's own `DeliveryPad` (find via workspace map attribute `OwnerUserId` on plot Model → `DeliveryPad`) — also hide when not carrying.
- **ShopController**: panel with two tabs (Passes / Boosts). Cards show Name, Description, price (try `MarketplaceService:GetProductInfoAsync` in pcall, fall back to Config RobuxPrice),
  owned state (green "OWNED") for passes, "Buy" → `PromptGamePassPurchase(LocalPlayer, id)` / `PromptProductPurchase`; Id==0 → disabled "Coming soon" with a clear note.
- **InfoController**: panel "How to play" (4 short steps) + "Odds" tab computed from `Economy.kindOdds/mutationOdds` for the player's current luck (shows luck used) — must be accurate (this is the disclosure).
- **RebirthController**: confirm modal (cost, what you lose/keep, new multiplier) → `RequestRebirth`; disabled with reason when not affordable.
- **DailyController**: panel/popup showing the 7-day ladder (claimed/current/locked), Claim button → `ClaimDaily`; auto-pops once per session when claimable.
- **BonkController**: handles the "Bonk" Tool's `Activated` (find nearest other player's character within range+slack in front of you client-side for UX only) → `Bonk:FireServer(userId)`; cooldown UI; swing animation optional; `BonkFeedback` shows a small hit/miss text.

## Quality bar

Each service/controller must be complete, not a stub: handle failure paths, player leave, respawn, rapid repeated input, and studio test mode.
Prefer small private helper functions; keep modules under ~600 lines (split helpers into sibling `ModuleScript`s in the same folder if needed, e.g. `LunchboxModel.luau`).
