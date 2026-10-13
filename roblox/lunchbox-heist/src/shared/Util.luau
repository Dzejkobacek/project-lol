--!strict
-- Small pure helpers shared by server and client.

local Util = {}

local SUFFIXES = { "", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc" }

-- 1234 -> "1.23K"; keeps at most 3 significant digits.
function Util.formatCash(value: number): string
	if value ~= value then
		return "0"
	end
	local negative = value < 0
	local n = math.abs(value)
	local tier = 0
	while n >= 1000 and tier < #SUFFIXES - 1 do
		n /= 1000
		tier += 1
	end
	local text: string
	if tier == 0 then
		text = tostring(math.floor(n))
	else
		local digits = n >= 100 and 0 or (n >= 10 and 1 or 2)
		text = string.format("%." .. digits .. "f", n)
		if string.find(text, ".", 1, true) then
			text = string.gsub(text, "0+$", "")
			text = string.gsub(text, "%.$", "")
		end
		text ..= SUFFIXES[tier + 1]
	end
	return (negative and "-" or "") .. text
end

-- 75 -> "1:15", 3700 -> "1:01:40"
function Util.formatDuration(seconds: number): string
	local s = math.max(0, math.ceil(seconds))
	local h = s // 3600
	local m = (s % 3600) // 60
	local sec = s % 60
	if h > 0 then
		return string.format("%d:%02d:%02d", h, m, sec)
	end
	return string.format("%d:%02d", m, sec)
end

function Util.clamp(value: number, minValue: number, maxValue: number): number
	return math.max(minValue, math.min(maxValue, value))
end

function Util.deepCopy<T>(value: T): T
	if type(value) ~= "table" then
		return value
	end
	local out = {}
	for k, v in pairs(value :: any) do
		out[Util.deepCopy(k)] = Util.deepCopy(v)
	end
	return (out :: any) :: T
end

-- Fill missing keys of `target` from `template` (recursively for plain tables). Returns target.
function Util.reconcile(target: { [any]: any }, template: { [any]: any }): { [any]: any }
	for k, v in pairs(template) do
		if target[k] == nil then
			target[k] = Util.deepCopy(v)
		elseif type(target[k]) == "table" and type(v) == "table" and #v == 0 then
			Util.reconcile(target[k], v)
		end
	end
	return target
end

local idCounter = 0
-- Unique id string. Uses HttpService GUIDs on Roblox, a counter fallback elsewhere (tests).
function Util.newId(): string
	idCounter += 1
	local ok, guid = pcall(function()
		return (game :: any):GetService("HttpService"):GenerateGUID(false)
	end)
	if ok and type(guid) == "string" then
		return guid
	end
	return string.format("id%d_%d", idCounter, math.floor(os.clock() * 1000000))
end

function Util.countKeys(t: { [any]: any }): number
	local n = 0
	for _ in pairs(t) do
		n += 1
	end
	return n
end

return Util
