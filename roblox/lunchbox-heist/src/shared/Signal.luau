--!strict
-- Tiny pure-Luau signal (no Instances). Handlers run in the firing thread, in connection order.

export type Connection = {
	Connected: boolean,
	Disconnect: (self: Connection) -> (),
}

export type Signal = {
	Connect: (self: Signal, handler: (...any) -> ()) -> Connection,
	Once: (self: Signal, handler: (...any) -> ()) -> Connection,
	Fire: (self: Signal, ...any) -> (),
	DisconnectAll: (self: Signal) -> (),
}

type Node = { handler: (...any) -> (), connection: Connection }

local Signal = {}
Signal.__index = Signal

function Signal.new(): Signal
	local self = setmetatable({ _nodes = {} :: { Node } }, Signal)
	return (self :: any) :: Signal
end

function Signal:Connect(handler: (...any) -> ()): Connection
	local nodes: { Node } = (self :: any)._nodes
	local connection: Connection
	connection = {
		Connected = true,
		Disconnect = function(c: Connection)
			c.Connected = false
			for i, node in ipairs(nodes) do
				if node.connection == c then
					table.remove(nodes, i)
					break
				end
			end
		end,
	}
	table.insert(nodes, { handler = handler, connection = connection })
	return connection
end

function Signal:Once(handler: (...any) -> ()): Connection
	local connection: Connection
	connection = (self :: any):Connect(function(...: any)
		connection:Disconnect()
		handler(...)
	end)
	return connection
end

function Signal:Fire(...: any)
	local nodes: { Node } = (self :: any)._nodes
	-- iterate over a copy so handlers can disconnect while we fire
	local copy = table.clone(nodes)
	for _, node in ipairs(copy) do
		if node.connection.Connected then
			task.spawn(node.handler, ...)
		end
	end
end

function Signal:DisconnectAll()
	local nodes: { Node } = (self :: any)._nodes
	for _, node in ipairs(nodes) do
		node.connection.Connected = false
	end
	table.clear(nodes)
end

return Signal
