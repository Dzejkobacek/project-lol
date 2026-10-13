--!strict
-- Pure game-economy math. No Instances, no services: unit-tested with plain Luau (tests/).

local Config = require(script.Parent.Config)

export type Multipliers = {
	rebirths: number,
	doubleCash: boolean,
	premium: boolean,
	eventCash: number,
}

local Economy = {}

local kindByKey: { [string]: Config.BoxKind } = {}
local kindTier: { [string]: number } = {}
for i, kind in ipairs(Config.BoxKinds) do
	kindByKey[kind.Key] = kind
	kindTier[kind.Key] = i - 1
end

local mutationByKey: { [string]: Config.Mutation } = {}
for _, m in ipairs(Config.Mutations) do
	mutationByKey[m.Key] = m
end

function Economy.getKind(key: string): Config.BoxKind?
	return kindByKey[key]
end

function Economy.getMutation(key: string): Config.Mutation?
	return mutationByKey[key]
end

function Economy.kindTier(key: string): number
	return kindTier[key] or 0
end

function Economy.rebirthCost(rebirths: number): number
	return math.floor(Config.Rebirth.BaseCost * Config.Rebirth.CostGrowth ^ rebirths)
end

function Economy.canRebirthMore(rebirths: number): boolean
	return rebirths < Config.Rebirth.Max
end

function Economy.rebirthMultiplier(rebirths: number): number
	return 1 + Config.Rebirth.IncomePerRebirth * rebirths
end

-- Total income multiplier applied to base box income.
function Economy.totalMultiplier(m: Multipliers): number
	local total = Economy.rebirthMultiplier(m.rebirths)
	if m.doubleCash then
		total *= Config.Multipliers.DoubleCashPass
	end
	if m.premium then
		total *= Config.Multipliers.PremiumCash
	end
	return total * math.max(0, m.eventCash)
end

-- Base income (cash/s) of one ready box, before player multipliers.
function Economy.boxBaseIncome(kindKey: string, mutationKey: string): number
	local kind = kindByKey[kindKey]
	if not kind then
		return 0
	end
	local mutation = mutationByKey[mutationKey]
	return kind.Income * (mutation and mutation.IncomeMult or 1)
end

function Economy.warmSeconds(kindKey: string, fastWarm: boolean): number
	local kind = kindByKey[kindKey]
	if not kind then
		return Config.Multipliers.MinWarmSeconds
	end
	local seconds = kind.WarmSeconds
	if fastWarm then
		seconds *= Config.Multipliers.FastWarmPass
	end
	return math.max(Config.Multipliers.MinWarmSeconds, math.floor(seconds + 0.5))
end

-- Effective belt weight. Luck boosts rarer kinds more: weight * (1 + (luck - 1) * tier * 0.5)
function Economy.beltWeight(kindKey: string, luck: number): number
	local kind = kindByKey[kindKey]
	if not kind then
		return 0
	end
	local tier = kindTier[kindKey] or 0
	return kind.Weight * (1 + math.max(0, luck - 1) * tier * 0.5)
end

function Economy.mutationWeight(mutationKey: string, luck: number): number
	local m = mutationByKey[mutationKey]
	if not m then
		return 0
	end
	if m.Key == "Plain" then
		return m.Weight
	end
	return m.Weight * math.max(1, luck)
end

-- Weighted random pick. rng must return a float in [0,1).
function Economy.pickWeighted<T>(items: { T }, weightOf: (T) -> number, rng: () -> number): T?
	local total = 0
	for _, item in ipairs(items) do
		total += math.max(0, weightOf(item))
	end
	if total <= 0 then
		return nil
	end
	local roll = rng() * total
	local acc = 0
	local last: T? = nil
	for _, item in ipairs(items) do
		local w = math.max(0, weightOf(item))
		if w > 0 then
			acc += w
			last = item
			if roll < acc then
				return item
			end
		end
	end
	return last
end

function Economy.rollKind(luck: number, rng: () -> number): Config.BoxKind
	local picked = Economy.pickWeighted(Config.BoxKinds, function(k: Config.BoxKind)
		return Economy.beltWeight(k.Key, luck)
	end, rng)
	return picked or Config.BoxKinds[1]
end

function Economy.rollMutation(luck: number, rng: () -> number): Config.Mutation
	local picked = Economy.pickWeighted(Config.Mutations, function(m: Config.Mutation)
		return Economy.mutationWeight(m.Key, luck)
	end, rng)
	return picked or Config.Mutations[1]
end

-- Probability table for the in-game odds panel (must match the real rolls exactly).
function Economy.kindOdds(luck: number): { { key: string, name: string, rarity: string, percent: number } }
	local total = 0
	for _, k in ipairs(Config.BoxKinds) do
		total += Economy.beltWeight(k.Key, luck)
	end
	local out = {}
	for _, k in ipairs(Config.BoxKinds) do
		table.insert(out, { key = k.Key, name = k.DisplayName, rarity = k.Rarity, percent = 100 * Economy.beltWeight(k.Key, luck) / total })
	end
	return out
end

function Economy.mutationOdds(luck: number): { { key: string, name: string, mult: number, percent: number } }
	local total = 0
	for _, m in ipairs(Config.Mutations) do
		total += Economy.mutationWeight(m.Key, luck)
	end
	local out = {}
	for _, m in ipairs(Config.Mutations) do
		table.insert(out, { key = m.Key, name = m.DisplayName, mult = m.IncomeMult, percent = 100 * Economy.mutationWeight(m.Key, luck) / total })
	end
	return out
end

-- Cash for a cash-pack product: N seconds of current income with a floor.
function Economy.cashPackAmount(packKey: string, incomePerSecond: number): number
	local pack = (Config.CashPacks :: any)[packKey]
	if not pack then
		return 0
	end
	return math.floor(math.max(pack.Minimum, incomePerSecond * pack.Seconds))
end

-- "Welcome back" income for time spent offline.
function Economy.offlineEarnings(incomePerSecond: number, secondsAway: number): number
	if secondsAway < Config.Offline.MinSeconds or incomePerSecond <= 0 then
		return 0
	end
	local capped = math.min(secondsAway, Config.Offline.MaxSeconds)
	return math.floor(incomePerSecond * capped * Config.Offline.Fraction)
end

function Economy.slotCount(hasExtraSlots: boolean): number
	if hasExtraSlots then
		return math.min(Config.Plots.MaxSlots, Config.Plots.BaseSlots + Config.Plots.ExtraSlotsPass)
	end
	return Config.Plots.BaseSlots
end

-- 1-based day index (clamped to the ladder) for a given streak count.
function Economy.dailyDayIndex(streakAfterClaim: number): number
	return math.clamp(streakAfterClaim, 1, #Config.Daily.Rewards)
end

return Economy
