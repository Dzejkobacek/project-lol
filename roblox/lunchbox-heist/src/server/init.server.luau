--!strict
-- Bootstrap: creates remotes, loads every service, then init() and start() them in order.
-- Services share one registry table (no cross-requires between services => no cycles).

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Remotes = require(ReplicatedStorage.Shared.Remotes)

export type Service = {
	Name: string,
	init: (services: { [string]: any }) -> (),
	start: (() -> ())?,
}

Remotes.init()

local ORDER = {
	"DataService",
	"WorldService",
	"MonetizationService",
	"BoxService",
	"StealService",
	"EventService",
	"EconomyService", -- last: pushes snapshots built from the services above
}

local services: { [string]: any } = {}
local folder = script:WaitForChild("Services")

for _, name in ipairs(ORDER) do
	local module = folder:FindFirstChild(name)
	if module and module:IsA("ModuleScript") then
		local ok, result = pcall(require, module)
		if ok then
			services[name] = result
		else
			warn(("[LunchboxHeist] failed to load %s: %s"):format(name, tostring(result)))
		end
	else
		warn(("[LunchboxHeist] missing service %s"):format(name))
	end
end

for _, name in ipairs(ORDER) do
	local service = services[name]
	if service and service.init then
		local ok, err = pcall(service.init, services)
		if not ok then
			warn(("[LunchboxHeist] %s.init failed: %s"):format(name, tostring(err)))
		end
	end
end

for _, name in ipairs(ORDER) do
	local service = services[name]
	if service and service.start then
		task.spawn(function()
			local ok, err = pcall(service.start)
			if not ok then
				warn(("[LunchboxHeist] %s.start failed: %s"):format(name, tostring(err)))
			end
		end)
	end
end

print(("[LunchboxHeist] server ready (%d services)"):format(#ORDER))
