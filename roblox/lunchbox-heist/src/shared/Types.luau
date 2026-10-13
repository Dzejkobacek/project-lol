--!strict
-- Shared type definitions. Pure types only (no runtime values).

export type BoxState = "warming" | "ready"

-- One lunchbox owned by a player. Persisted.
export type BoxData = {
	id: string, -- unique id (Util.newId)
	kind: string, -- key into Config.BoxKinds
	state: BoxState,
	warmEndsAt: number, -- os.time() when warming finishes (UTC unix seconds)
	mutation: string, -- key into Config.Mutations; rolled at purchase, revealed when ready
	slot: number, -- 1..Config.Plots.MaxSlots; slot index on the owner's plot
	inTransit: boolean?, -- true while a thief is carrying it (not earning, not stealable again)
}

export type DailyData = {
	streak: number,
	lastClaimDay: number, -- floor(os.time() / 86400) of last claim; 0 = never
}

-- Persisted profile. Bump Config.Data.SchemaVersion when changing shape.
export type PlayerData = {
	version: number,
	cash: number,
	rebirths: number,
	boxes: { BoxData },
	totalEarned: number,
	steals: number, -- successful steals delivered
	timesStolen: number,
	lastSeen: number, -- os.time()
	daily: DailyData,
	freeLockReadyAt: number, -- os.time() when the free base lock can be used again
	luckUntil: number, -- os.time() end of personal Luck Potion (0 = none)
	receipts: { [string]: number }, -- PurchaseId -> os.time(); idempotency for ProcessReceipt
	protectedUntil: number, -- os.time() end of new-player spawn protection
	seenTutorial: boolean,
}

export type EventInfo = {
	key: string,
	name: string,
	endsAt: number, -- workspace:GetServerTimeNow() style unix seconds
	luckMult: number,
	cashMult: number,
}

export type DailyState = {
	canClaim: boolean,
	streak: number, -- current streak length (days)
	nextDay: number, -- 1..#Config.Daily.Rewards that a claim would grant
	nextCash: number,
	nextLockSeconds: number,
}

export type CarryInfo = {
	boxId: string,
	kind: string,
	ownerName: string,
	expiresAt: number,
}

-- Everything the client HUD needs; pushed with Remotes.StateUpdate.
export type StateSnapshot = {
	cash: number,
	rebirths: number,
	incomePerSecond: number, -- fully multiplied cash/second
	multiplier: number, -- total income multiplier
	luck: number, -- total luck multiplier (pass * potion * event)
	slots: number, -- unlocked slot count
	usedSlots: number,
	lockUntil: number, -- os.time() base lock end (<= now = unlocked)
	freeLockReadyAt: number,
	protectedUntil: number,
	luckUntil: number,
	rebirthCost: number,
	canRebirth: boolean,
	passes: { [string]: boolean },
	premium: boolean,
	daily: DailyState,
	event: EventInfo?,
	carrying: CarryInfo?,
	steals: number,
	timesStolen: number,
	totalEarned: number,
	serverTime: number, -- os.time() at send; clients compute offsets with it
}

-- World
export type Slot = {
	Index: number,
	Pad: BasePart, -- flat pad where the lunchbox model sits (top surface = floor of the slot)
	LockedSign: BasePart?, -- shown when the slot is not unlocked yet
	Unlocked: boolean,
}

export type Plot = {
	Index: number,
	Model: Model,
	Owner: Player?,
	Slots: { Slot },
	DeliveryPad: BasePart, -- thieves bring stolen boxes here
	SpawnCFrame: CFrame,
	Shield: BasePart, -- translucent force-field part shown while the base is locked
	Sign: TextLabel?, -- owner name label (SurfaceGui)
}

return {}
