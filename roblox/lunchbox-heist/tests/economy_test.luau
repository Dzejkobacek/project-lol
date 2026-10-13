-- Executed after the shared modules are inlined by tests/run.py (locals Signal, Util, Config, Economy exist).
local passed, failed = 0, 0
local function check(name, cond, detail)
	if cond then
		passed += 1
	else
		failed += 1
		print("FAIL: " .. name .. (detail and (" -> " .. tostring(detail)) or ""))
	end
end
local function near(a, b, eps) return math.abs(a - b) <= (eps or 1e-6) end

-- Util.formatCash
check("fmt 0", Util.formatCash(0) == "0")
check("fmt 999", Util.formatCash(999) == "999")
check("fmt 1000", Util.formatCash(1000) == "1K", Util.formatCash(1000))
check("fmt 1234", Util.formatCash(1234) == "1.23K", Util.formatCash(1234))
check("fmt 12345", Util.formatCash(12345) == "12.3K", Util.formatCash(12345))
check("fmt 123456", Util.formatCash(123456) == "123K", Util.formatCash(123456))
check("fmt 2.5M", Util.formatCash(2500000) == "2.5M", Util.formatCash(2500000))
check("fmt neg", Util.formatCash(-1500) == "-1.5K", Util.formatCash(-1500))
check("fmt nan", Util.formatCash(0 / 0) == "0")
check("fmt huge", #Util.formatCash(1e300) > 0)
check("dur 75", Util.formatDuration(75) == "1:15", Util.formatDuration(75))
check("dur 3700", Util.formatDuration(3700) == "1:01:40", Util.formatDuration(3700))
check("dur neg", Util.formatDuration(-5) == "0:00")

-- Util.reconcile / deepCopy
local tpl = { a = 1, nested = { x = 1, y = 2 }, list = { 1, 2 } }
local data = { nested = { x = 9 } }
Util.reconcile(data, tpl)
check("reconcile fills", data.a == 1 and data.nested.y == 2 and data.nested.x == 9)
check("reconcile list copy", data.list ~= tpl.list and data.list[2] == 2)
local copy = Util.deepCopy(tpl)
copy.nested.x = 5
check("deepCopy independent", tpl.nested.x == 1)

-- Signal
local s = Signal.new()
local hits = 0
local c = s:Connect(function(v) hits += v end)
s:Fire(2)
c:Disconnect()
s:Fire(5)
check("signal connect/disconnect", hits == 2, hits)
local once = 0
s:Once(function() once += 1 end)
s:Fire()
s:Fire()
check("signal once", once == 1, once)

-- Config sanity
local weightSum = 0
for i, k in ipairs(Config.BoxKinds) do
	check("kind positive " .. k.Key, k.Price > 0 and k.Income > 0 and k.WarmSeconds > 0 and k.Weight > 0)
	weightSum += k.Weight
	if i > 1 then
		local prev = Config.BoxKinds[i - 1]
		check("kinds ascend price " .. k.Key, k.Price > prev.Price)
		check("kinds ascend income " .. k.Key, k.Income > prev.Income)
		check("kinds payback grows or flat " .. k.Key, k.Price / k.Income >= prev.Price / prev.Income * 0.9)
	end
end
check("kind weights sum", weightSum > 0)
local keys = {}
for _, k in ipairs(Config.BoxKinds) do check("unique kind " .. k.Key, not keys[k.Key]) keys[k.Key] = true end
check("plain mutation exists", Economy.getMutation("Plain") ~= nil)
check("first kind affordable at start", Config.Start.Cash >= Config.BoxKinds[1].Price)

-- Payback times (seconds to earn the price back) should be sane: 20s .. 15min
for _, k in ipairs(Config.BoxKinds) do
	local payback = k.Price / k.Income
	check("payback sane " .. k.Key, payback >= 20 and payback <= 900, payback)
end

-- Economy basics
check("rebirth cost 0", Economy.rebirthCost(0) == Config.Rebirth.BaseCost)
check("rebirth cost grows", Economy.rebirthCost(3) > Economy.rebirthCost(2))
check("rebirth mult", near(Economy.rebirthMultiplier(2), 1 + 2 * Config.Rebirth.IncomePerRebirth))
check("total mult base", near(Economy.totalMultiplier({ rebirths = 0, doubleCash = false, premium = false, eventCash = 1 }), 1))
check("total mult all", near(Economy.totalMultiplier({ rebirths = 2, doubleCash = true, premium = true, eventCash = 2 }), 2 * 2 * 1.1 * 2))
check("box income golden", Economy.boxBaseIncome("Ramen", "Golden") == 30 * 5)
check("box income unknown", Economy.boxBaseIncome("Nope", "Plain") == 0)
check("warm fast", Economy.warmSeconds("Burger", true) == 36, Economy.warmSeconds("Burger", true))
check("warm min", Economy.warmSeconds("Sandwich", true) >= Config.Multipliers.MinWarmSeconds)
check("slot count", Economy.slotCount(false) == 10 and Economy.slotCount(true) == 15)
check("offline none", Economy.offlineEarnings(100, 10) == 0)
check("offline capped", Economy.offlineEarnings(100, 999999) == math.floor(100 * Config.Offline.MaxSeconds * Config.Offline.Fraction))
check("cash pack min", Economy.cashPackAmount("CashSmall", 1) == Config.CashPacks.CashSmall.Minimum)
check("cash pack scales", Economy.cashPackAmount("CashLarge", 1000) == 1000 * 14400)
check("cash pack unknown", Economy.cashPackAmount("Nope", 1000) == 0)
check("daily idx clamp", Economy.dailyDayIndex(0) == 1 and Economy.dailyDayIndex(99) == #Config.Daily.Rewards)

-- Odds: sum to 100, luck shifts mass toward rarer boxes, odds match real sampling
for _, luck in ipairs({ 1, 1.5, 2, 3 }) do
	local sum = 0
	for _, o in ipairs(Economy.kindOdds(luck)) do sum += o.percent end
	check("kind odds sum luck " .. luck, near(sum, 100, 1e-6), sum)
	sum = 0
	for _, o in ipairs(Economy.mutationOdds(luck)) do sum += o.percent end
	check("mutation odds sum luck " .. luck, near(sum, 100, 1e-6), sum)
end
local base = Economy.kindOdds(1)
local lucky = Economy.kindOdds(2)
check("luck lowers first kind", lucky[1].percent < base[1].percent)
check("luck raises last kind", lucky[#lucky].percent > base[#base].percent)

-- deterministic LCG for sampling tests
math.randomseed(20260101)
local function rng()
	return math.random()
end
local N = 200000
local counts = {}
for _ = 1, N do
	local k = Economy.rollKind(1, rng)
	counts[k.Key] = (counts[k.Key] or 0) + 1
end
for _, o in ipairs(Economy.kindOdds(1)) do
	local observed = 100 * (counts[o.key] or 0) / N
	check("sampling matches odds " .. o.key, math.abs(observed - o.percent) < 0.6, observed .. " vs " .. o.percent)
end
local mcounts = {}
for _ = 1, N do
	local m = Economy.rollMutation(1, rng)
	mcounts[m.Key] = (mcounts[m.Key] or 0) + 1
end
for _, o in ipairs(Economy.mutationOdds(1)) do
	local observed = 100 * (mcounts[o.key] or 0) / N
	check("mutation sampling " .. o.key, math.abs(observed - o.percent) < 0.5, observed .. " vs " .. o.percent)
end

-- pickWeighted edge cases
check("pick empty", Economy.pickWeighted({}, function() return 1 end, rng) == nil)
check("pick zero weights", Economy.pickWeighted({ 1, 2 }, function() return 0 end, rng) == nil)
check("pick single", Economy.pickWeighted({ "a" }, function() return 5 end, function() return 0.999999 end) == "a")
check("pick skips zero", Economy.pickWeighted({ "a", "b", "c" }, function(x) return x == "b" and 1 or 0 end, function() return 0.5 end) == "b")

print(("economy tests: %d passed, %d failed"):format(passed, failed))
if failed > 0 then error("tests failed") end
