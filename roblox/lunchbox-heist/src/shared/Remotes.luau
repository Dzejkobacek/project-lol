--!strict
-- Creates (server) / waits for (client) all RemoteEvents listed in Config.Remotes.
-- Server: call Remotes.init() once, then Remotes.get(name). Client: Remotes.get(name) yields until it exists.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Config = require(script.Parent.Config)

local FOLDER_NAME = "LH_Remotes"

local Remotes = {}

local cache: { [string]: RemoteEvent } = {}

function Remotes.init()
	assert(RunService:IsServer(), "Remotes.init is server-only")
	local folder = ReplicatedStorage:FindFirstChild(FOLDER_NAME)
	if not folder then
		local created = Instance.new("Folder")
		created.Name = FOLDER_NAME
		created.Parent = ReplicatedStorage
		folder = created
	end
	assert(folder, "remotes folder")
	for _, name in ipairs(Config.Remotes) do
		local existing = folder:FindFirstChild(name)
		if not existing then
			local remote = Instance.new("RemoteEvent")
			remote.Name = name
			remote.Parent = folder
			existing = remote
		end
		cache[name] = existing :: RemoteEvent
	end
end

function Remotes.get(name: string): RemoteEvent
	local cached = cache[name]
	if cached then
		return cached
	end
	local folder = ReplicatedStorage:WaitForChild(FOLDER_NAME)
	local remote = folder:WaitForChild(name) :: RemoteEvent
	cache[name] = remote
	return remote
end

return Remotes
