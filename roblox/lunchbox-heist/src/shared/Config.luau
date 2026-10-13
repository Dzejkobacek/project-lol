--!strict
-- ALL tunable game data lives here. To theme / retune a new game, change this file (and the art in WorldService).
-- Numbers are first-pass defaults: tune after watching real playtests.

export type BoxKind = {
	Key: string,
	DisplayName: string,
	Rarity: string,
	Price: number,
	Income: number, -- base cash / second when ready (before mutation + multipliers)
	WarmSeconds: number,
	Weight: number, -- relative spawn weight on the belt (before luck)
	Color: Color3,
}

export type Mutation = {
	Key: string,
	DisplayName: string,
	IncomeMult: number,
	Weight: number, -- relative roll weight (non-"Plain" weights are scaled by luck)
	Color: Color3,
}

export type PassDef = {
	Key: string,
	Name: string,
	Description: string,
	Id: number, -- Roblox GamePass id. 0 = not created yet (see docs/SETUP.md)
	RobuxPrice: number, -- display only; real price comes from MarketplaceService when available
}

export type ProductDef = {
	Key: string,
	Name: string,
	Description: string,
	Id: number, -- Roblox Developer Product id. 0 = not created yet
	RobuxPrice: number, -- display only
}

local Config = {}

Config.GameName = "Lunchbox Heist"

Config.Data = {
	StoreName = "LunchboxHeist_v1",
	KeyPrefix = "Player_",
	SchemaVersion = 1,
	AutosaveSeconds = 60,
	LockTimeoutSeconds = 120, -- a session lock older than this is considered dead
	MaxReceiptHistory = 200,
}

Config.Plots = {
	Count = 8,
	BaseSlots = 10,
	ExtraSlotsPass = 5,
	MaxSlots = 15,
}

Config.Belt = {
	SpawnInterval = 3.0, -- seconds between belt boxes
	MaxOnBelt = 14,
	Speed = 12, -- studs / second
}

Config.Start = {
	Cash = 150,
}

Config.Rebirth = {
	BaseCost = 750_000,
	CostGrowth = 3.2,
	IncomePerRebirth = 0.5, -- +50% income per rebirth (additive)
	Max = 40,
}

Config.Multipliers = {
	PremiumCash = 1.1,
	DoubleCashPass = 2,
	LuckyPass = 1.5,
	LuckPotion = 2,
	FastWarmPass = 0.6, -- warm time factor
	MinWarmSeconds = 3,
}

Config.Offline = {
	MaxSeconds = 1800, -- cap on "welcome back" income
	Fraction = 0.25,
	MinSeconds = 60,
}

Config.Steal = {
	HoldDuration = 1.5, -- seconds the thief holds the prompt
	PromptDistance = 9,
	CarryTimeout = 60, -- seconds to deliver before the box returns to its owner
	CarrySpeedFactor = 0.85,
	NewPlayerProtection = 180, -- seconds of base protection for brand-new profiles
	FreeLockSeconds = 45,
	FreeLockCooldown = 300,
	MaxLockSeconds = 300,
	ProductLockSeconds = 60,
	MinStealableIncome = 0, -- boxes must be ready; no other restriction
	BonkRange = 10,
	BonkCooldown = 1.2,
	BonkDropsCarry = true,
	StunSeconds = 1.5,
}

Config.Events = {
	IntervalSeconds = 900, -- an event every 15 minutes
	DurationSeconds = 300,
	List = {
		{ Key = "LuckyHour", Name = "Lucky Hour", LuckMult = 2, CashMult = 1 },
		{ Key = "CashRush", Name = "Cash Rush", LuckMult = 1, CashMult = 2 },
		{ Key = "GoldenFeast", Name = "Golden Feast", LuckMult = 1.5, CashMult = 1.5 },
	},
}

Config.Daily = {
	-- Reward ladder; streak resets if a day is missed (after the last day it repeats the last reward).
	Rewards = {
		{ Cash = 500, LockSeconds = 0 },
		{ Cash = 2_500, LockSeconds = 0 },
		{ Cash = 12_000, LockSeconds = 60 },
		{ Cash = 60_000, LockSeconds = 0 },
		{ Cash = 250_000, LockSeconds = 120 },
		{ Cash = 1_000_000, LockSeconds = 0 },
		{ Cash = 5_000_000, LockSeconds = 180 },
	},
}

Config.BoxKinds = {
	{ Key = "Sandwich", DisplayName = "Pocket Sandwich", Rarity = "Common", Price = 50, Income = 1, WarmSeconds = 8, Weight = 45, Color = Color3.fromRGB(222, 184, 135) },
	{ Key = "Bento", DisplayName = "Rice Bento", Rarity = "Common", Price = 400, Income = 6, WarmSeconds = 15, Weight = 28, Color = Color3.fromRGB(236, 240, 241) },
	{ Key = "Ramen", DisplayName = "Ramen Cup", Rarity = "Uncommon", Price = 2_500, Income = 30, WarmSeconds = 30, Weight = 15, Color = Color3.fromRGB(231, 76, 60) },
	{ Key = "Burger", DisplayName = "Burger Box", Rarity = "Rare", Price = 15_000, Income = 150, WarmSeconds = 60, Weight = 7, Color = Color3.fromRGB(230, 126, 34) },
	{ Key = "Sushi", DisplayName = "Sushi Set", Rarity = "Epic", Price = 120_000, Income = 1_000, WarmSeconds = 120, Weight = 3.5, Color = Color3.fromRGB(155, 89, 182) },
	{ Key = "Thermos", DisplayName = "Golden Thermos", Rarity = "Legendary", Price = 1_500_000, Income = 10_000, WarmSeconds = 300, Weight = 1.2, Color = Color3.fromRGB(241, 196, 15) },
	{ Key = "Feast", DisplayName = "Cosmic Feast", Rarity = "Mythic", Price = 25_000_000, Income = 150_000, WarmSeconds = 600, Weight = 0.3, Color = Color3.fromRGB(46, 204, 113) },
} :: { BoxKind }

Config.Mutations = {
	{ Key = "Plain", DisplayName = "Plain", IncomeMult = 1, Weight = 78, Color = Color3.fromRGB(189, 195, 199) },
	{ Key = "Spicy", DisplayName = "Spicy", IncomeMult = 1.5, Weight = 14, Color = Color3.fromRGB(231, 76, 60) },
	{ Key = "Crispy", DisplayName = "Crispy", IncomeMult = 2.5, Weight = 5.5, Color = Color3.fromRGB(230, 126, 34) },
	{ Key = "Golden", DisplayName = "Golden", IncomeMult = 5, Weight = 2, Color = Color3.fromRGB(241, 196, 15) },
	{ Key = "Rainbow", DisplayName = "Rainbow", IncomeMult = 10, Weight = 0.5, Color = Color3.fromRGB(155, 89, 182) },
} :: { Mutation }

Config.Passes = {
	{ Key = "DoubleCash", Name = "2x Cash", Description = "Double all cash you earn. Forever.", Id = 0, RobuxPrice = 399 },
	{ Key = "LuckyBoxes", Name = "Lucky Boxes", Description = "Rare mutations are 50% more likely.", Id = 0, RobuxPrice = 249 },
	{ Key = "ExtraSlots", Name = "+5 Slots", Description = "Five more shelves for your lunchboxes.", Id = 0, RobuxPrice = 299 },
	{ Key = "FastWarm", Name = "Fast Warmers", Description = "Boxes finish warming 40% faster.", Id = 0, RobuxPrice = 199 },
} :: { PassDef }

Config.Products = {
	{ Key = "CashSmall", Name = "Cash Pack (10 min)", Description = "10 minutes of your income, instantly.", Id = 0, RobuxPrice = 49 },
	{ Key = "CashMedium", Name = "Cash Pack (1 hour)", Description = "1 hour of your income, instantly.", Id = 0, RobuxPrice = 149 },
	{ Key = "CashLarge", Name = "Cash Pack (4 hours)", Description = "4 hours of your income, instantly.", Id = 0, RobuxPrice = 399 },
	{ Key = "SkipWarm", Name = "Instant Warm", Description = "Finish warming every box right now.", Id = 0, RobuxPrice = 79 },
	{ Key = "Lock60", Name = "Base Lock (60s)", Description = "Nobody can steal from you for 60 seconds.", Id = 0, RobuxPrice = 29 },
	{ Key = "LuckPotion", Name = "Luck Potion (10 min)", Description = "Rare mutations are 2x as likely for 10 minutes.", Id = 0, RobuxPrice = 99 },
} :: { ProductDef }

Config.CashPacks = {
	-- seconds of current income granted, with a floor so early players still get something
	CashSmall = { Seconds = 600, Minimum = 2_000 },
	CashMedium = { Seconds = 3600, Minimum = 12_000 },
	CashLarge = { Seconds = 14400, Minimum = 50_000 },
}

Config.LuckPotionSeconds = 600

Config.Monetization = {
	-- In Studio, purchases whose Id is 0 are granted for free so you can test the full flow.
	StudioTestMode = true,
}

Config.Tags = {
	Dish = "LH_Dish", -- a ready box model on a plot; attributes: OwnerUserId (number), BoxId (string)
	BeltBox = "LH_BeltBox", -- a box on the conveyor; attribute: BeltId (string)
}

Config.Remotes = {
	"StateUpdate", -- S->C  (snapshot: Types.StateSnapshot)
	"Toast", -- S->C  (kind: "info" | "good" | "bad" | "steal", text: string)
	"RequestState", -- C->S  ()
	"RequestRebirth", -- C->S  ()
	"RequestFreeLock", -- C->S  ()
	"ClaimDaily", -- C->S  ()
	"RequestHome", -- C->S  () teleport to own plot
	"Bonk", -- C->S  (targetUserId: number)
	"BonkFeedback", -- S->C  (kind: "hit" | "miss" | "cooldown")
	"Announce", -- S->C  (text: string, seconds: number) big banner (events)
}

Config.Colors = {
	Orange = Color3.fromRGB(230, 126, 34),
	Green = Color3.fromRGB(46, 204, 113),
	Ink = Color3.fromRGB(29, 26, 23),
	Cream = Color3.fromRGB(255, 250, 244),
}

return Config
