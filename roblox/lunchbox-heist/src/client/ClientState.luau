--!strict
-- Client-side cache of the latest server StateSnapshot + tiny change signal.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Remotes = require(ReplicatedStorage.Shared.Remotes)
local Signal = require(ReplicatedStorage.Shared.Signal)
local Types = require(ReplicatedStorage.Shared.Types)

local ClientState = {}

ClientState.Changed = Signal.new() -- fires (snapshot: Types.StateSnapshot) after every update

local current: Types.StateSnapshot? = nil
local offset = 0 -- serverTime - os.time() at receipt (os.time() on client may differ from server)

function ClientState.get(): Types.StateSnapshot?
	return current
end

-- Server "now" in unix seconds, comparable with timestamps in the snapshot (lockUntil, endsAt, ...).
function ClientState.serverNow(): number
	return workspace:GetServerTimeNow()
end

function ClientState.start()
	Remotes.get("StateUpdate").OnClientEvent:Connect(function(snapshot: Types.StateSnapshot)
		current = snapshot
		offset = snapshot.serverTime - os.time()
		ClientState.Changed:Fire(snapshot)
	end)
	Remotes.get("RequestState"):FireServer()
end

function ClientState.timeOffset(): number
	return offset
end

return ClientState
