--!strict
-- Client bootstrap: waits for shared code + remotes, then starts each controller.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

ReplicatedStorage:WaitForChild("Shared")
ReplicatedStorage:WaitForChild("LH_Remotes")

local ClientState = require(script.ClientState)

local CONTROLLERS = {
	"ToastController",
	"HudController",
	"CarryController",
	"ShopController",
	"InfoController",
	"RebirthController",
	"DailyController",
	"BonkController",
}

local folder = script:WaitForChild("Controllers")

ClientState.start()

for _, name in ipairs(CONTROLLERS) do
	local module = folder:FindFirstChild(name)
	if module and module:IsA("ModuleScript") then
		local ok, controller = pcall(require, module)
		if ok and type(controller) == "table" and controller.start then
			local started, err = pcall(controller.start)
			if not started then
				warn(("[LunchboxHeist] %s.start failed: %s"):format(name, tostring(err)))
			end
		elseif not ok then
			warn(("[LunchboxHeist] failed to load %s: %s"):format(name, tostring(controller)))
		end
	else
		warn(("[LunchboxHeist] missing controller %s"):format(name))
	end
end
