--!strict
-- Small helper kit for building the HUD in code (no Studio-made GUI assets needed).
-- Brand: orange #E67E22, green #2ECC71, ink #1D1A17, cream #FFFAF4.

local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")

local UIKit = {}

UIKit.Theme = {
	Orange = Color3.fromRGB(230, 126, 34),
	OrangeDark = Color3.fromRGB(207, 109, 23),
	Green = Color3.fromRGB(46, 204, 113),
	GreenDark = Color3.fromRGB(26, 154, 81),
	Red = Color3.fromRGB(229, 72, 77),
	Ink = Color3.fromRGB(29, 26, 23),
	InkSoft = Color3.fromRGB(74, 69, 64),
	Cream = Color3.fromRGB(255, 250, 244),
	White = Color3.fromRGB(255, 255, 255),
	Muted = Color3.fromRGB(122, 115, 108),
	Line = Color3.fromRGB(236, 232, 227),
	Font = Enum.Font.GothamBold,
	FontBody = Enum.Font.Gotham,
}

export type Props = { [string]: any }

-- Create an Instance, assign props (Parent last), and parent children.
function UIKit.create(className: string, props: Props?, children: { Instance }?): any
	local inst = Instance.new(className)
	local parent: Instance? = nil
	if props then
		for key, value in pairs(props) do
			if key == "Parent" then
				parent = value :: Instance
			else
				(inst :: any)[key] = value
			end
		end
	end
	if children then
		for _, child in ipairs(children) do
			child.Parent = inst
		end
	end
	inst.Parent = parent
	return inst
end

function UIKit.corner(parent: Instance, radius: number?): UICorner
	return UIKit.create("UICorner", { CornerRadius = UDim.new(0, radius or 12), Parent = parent })
end

function UIKit.stroke(parent: Instance, color: Color3?, thickness: number?): UIStroke
	return UIKit.create("UIStroke", {
		Color = color or UIKit.Theme.Line,
		Thickness = thickness or 1.5,
		ApplyStrokeMode = Enum.ApplyStrokeMode.Border,
		Parent = parent,
	})
end

function UIKit.padding(parent: Instance, all: number): UIPadding
	return UIKit.create("UIPadding", {
		PaddingTop = UDim.new(0, all),
		PaddingBottom = UDim.new(0, all),
		PaddingLeft = UDim.new(0, all),
		PaddingRight = UDim.new(0, all),
		Parent = parent,
	})
end

function UIKit.isMobile(): boolean
	return UserInputService.TouchEnabled and not UserInputService.KeyboardEnabled
end

function UIKit.screenGui(name: string, displayOrder: number?): ScreenGui
	local player = game:GetService("Players").LocalPlayer
	local gui = UIKit.create("ScreenGui", {
		Name = name,
		ResetOnSpawn = false,
		IgnoreGuiInset = false,
		ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
		DisplayOrder = displayOrder or 1,
	}) :: ScreenGui
	gui.Parent = player:WaitForChild("PlayerGui")
	return gui
end

function UIKit.label(props: Props): TextLabel
	local base: Props = {
		BackgroundTransparency = 1,
		Font = UIKit.Theme.Font,
		TextColor3 = UIKit.Theme.Ink,
		TextSize = 18,
		TextWrapped = true,
		Text = "",
	}
	for k, v in pairs(props) do
		base[k] = v
	end
	return UIKit.create("TextLabel", base) :: TextLabel
end

-- Rounded filled button with press feedback. props: Text, Size, Position, Color, TextColor, Parent, OnClick.
function UIKit.button(props: Props): TextButton
	local color: Color3 = props.Color or UIKit.Theme.Orange
	local btn = UIKit.create("TextButton", {
		Name = props.Name or "Button",
		AutoButtonColor = false,
		BackgroundColor3 = color,
		Font = UIKit.Theme.Font,
		Text = props.Text or "",
		TextColor3 = props.TextColor or UIKit.Theme.White,
		TextSize = props.TextSize or 18,
		Size = props.Size or UDim2.fromOffset(160, 44),
		Position = props.Position or UDim2.new(),
		AnchorPoint = props.AnchorPoint or Vector2.zero,
		LayoutOrder = props.LayoutOrder or 0,
		Parent = props.Parent,
	}) :: TextButton
	UIKit.corner(btn, props.Radius or 12)
	btn.MouseEnter:Connect(function()
		UIKit.tween(btn, 0.12, { BackgroundColor3 = color:Lerp(Color3.new(1, 1, 1), 0.12) })
	end)
	btn.MouseLeave:Connect(function()
		UIKit.tween(btn, 0.12, { BackgroundColor3 = color })
	end)
	btn.MouseButton1Down:Connect(function()
		UIKit.tween(btn, 0.06, { BackgroundColor3 = color:Lerp(Color3.new(0, 0, 0), 0.15) })
	end)
	btn.MouseButton1Up:Connect(function()
		UIKit.tween(btn, 0.1, { BackgroundColor3 = color })
	end)
	local onClick = props.OnClick
	if onClick then
		btn.MouseButton1Click:Connect(onClick)
	end
	return btn
end

function UIKit.tween(inst: Instance, seconds: number, goal: { [string]: any }, style: Enum.EasingStyle?): Tween
	local tween = TweenService:Create(inst, TweenInfo.new(seconds, style or Enum.EasingStyle.Quad, Enum.EasingDirection.Out), goal)
	tween:Play()
	return tween
end

export type Panel = {
	Gui: ScreenGui,
	Frame: Frame,
	Body: Frame,
	Open: () -> (),
	Close: () -> (),
	Toggle: () -> (),
	IsOpen: () -> boolean,
}

-- Centered modal card with a title and close button. Content goes into panel.Body.
function UIKit.panel(name: string, title: string, size: UDim2): Panel
	local gui = UIKit.screenGui(name, 20)
	gui.Enabled = false
	local backdrop = UIKit.create("Frame", {
		Name = "Backdrop",
		BackgroundColor3 = Color3.new(0, 0, 0),
		BackgroundTransparency = 0.45,
		Size = UDim2.fromScale(1, 1),
		Parent = gui,
	})
	local frame = UIKit.create("Frame", {
		Name = "Card",
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.5),
		Size = size,
		BackgroundColor3 = UIKit.Theme.Cream,
		Parent = backdrop,
	}) :: Frame
	UIKit.corner(frame, 20)
	UIKit.stroke(frame, UIKit.Theme.White, 3)
	UIKit.create("UISizeConstraint", { MaxSize = Vector2.new(720, 560), MinSize = Vector2.new(280, 240), Parent = frame })
	UIKit.label({
		Name = "Title",
		Text = title,
		TextSize = 26,
		TextXAlignment = Enum.TextXAlignment.Left,
		Size = UDim2.new(1, -80, 0, 48),
		Position = UDim2.fromOffset(20, 8),
		Parent = frame,
	})
	local body = UIKit.create("Frame", {
		Name = "Body",
		BackgroundTransparency = 1,
		Position = UDim2.fromOffset(16, 64),
		Size = UDim2.new(1, -32, 1, -80),
		Parent = frame,
	}) :: Frame

	local panel: Panel
	local open = false
	local function setOpen(value: boolean)
		open = value
		gui.Enabled = value
		if value then
			frame.Size = UDim2.new(size.X.Scale * 0.92, size.X.Offset * 0.92, size.Y.Scale * 0.92, size.Y.Offset * 0.92)
			UIKit.tween(frame, 0.18, { Size = size }, Enum.EasingStyle.Back)
		end
	end
	UIKit.button({
		Name = "Close",
		Text = "X",
		Size = UDim2.fromOffset(40, 40),
		Position = UDim2.new(1, -52, 0, 12),
		Color = UIKit.Theme.Ink,
		Parent = frame,
		OnClick = function()
			setOpen(false)
		end,
	})
	panel = {
		Gui = gui,
		Frame = frame,
		Body = body,
		Open = function()
			setOpen(true)
		end,
		Close = function()
			setOpen(false)
		end,
		Toggle = function()
			setOpen(not open)
		end,
		IsOpen = function()
			return open
		end,
	}
	return panel
end

return UIKit
