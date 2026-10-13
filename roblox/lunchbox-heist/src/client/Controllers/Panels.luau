--!strict
-- Tiny registry so HUD buttons can open panels owned by other controllers without requiring them.

local Panels = {}

local registry: { [string]: () -> () } = {}

function Panels.register(name: string, open: () -> ())
	registry[name] = open
end

function Panels.open(name: string)
	local fn = registry[name]
	if fn then
		fn()
	end
end

function Panels.has(name: string): boolean
	return registry[name] ~= nil
end

return Panels
