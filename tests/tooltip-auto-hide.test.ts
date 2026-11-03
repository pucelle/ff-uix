import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {PopupStacker} from 'ff-kit'


vi.mock('../src/tools/device', () => ({device: {mouse: false}}))

vi.mock('../src/components/tooltip', () => ({
	Tooltip: class {
		static triangleWidth = 12
		static triangleHeight = 6
	},
}))

vi.mock('../src/bindings/popup-helpers/popup-binder', () => ({
	PopupTriggerBinder: class {
		trigger = 'hover'
		bindLeaveBeforeShow = vi.fn()
		bindLeave = vi.fn()
		unbindEnter = vi.fn()
	},
}))

import {popup} from '../src/bindings/popup'
import {tooltip} from '../src/bindings/tooltip'


/** Create a tooltip while keeping the real popup state and tooltip lifecycle. */
function createTooltip() {
	let binding = new tooltip({} as Element, {})
	vi.spyOn(binding as any, 'createRendered').mockImplementation(() => {
		binding['popup'] = {el: {}} as any
		return false
	})

	return binding
}


describe('tooltip auto hiding', () => {
	beforeEach(() => {
		vi.useFakeTimers()
		vi.spyOn(PopupStacker, 'onEnter').mockImplementation(() => {})
		vi.spyOn(popup.prototype as any, 'updatePopup').mockResolvedValue(undefined)
		vi.spyOn(popup.prototype as any, 'appendPopup').mockImplementation(() => {})
		vi.spyOn(popup.prototype as any, 'alignPopup').mockImplementation(() => {})
		vi.spyOn(popup.prototype as any, 'doHide').mockResolvedValue(undefined)
	})

	afterEach(() => {
		vi.clearAllTimers()
		vi.restoreAllMocks()
		vi.useRealTimers()
	})

	it('defaults to 3000ms on mouse-less devices without adding hideDelay', async () => {
		let binding = createTooltip()
		binding.update('Help')
		binding.showPopup()
		await vi.advanceTimersByTimeAsync(2999)
		expect(binding.opened).toBe(true)
		await vi.advanceTimersByTimeAsync(1)
		expect(binding.opened).toBe(false)
		expect(vi.getTimerCount()).toBe(0)
	})

	it('starts the delay after rendering, not while waiting to show or render', async () => {
		let binding = createTooltip()
		let finishRender!: () => void
		let rendering = new Promise<void>(resolve => { finishRender = resolve })
		vi.spyOn(binding as any, 'updatePopup').mockReturnValue(rendering)
		binding.update('Help', {showDelay: 100, autoHideDelay: 50})
		binding.showPopupLater()
		await vi.advanceTimersByTimeAsync(99)
		expect(binding.opened).toBe(false)
		await vi.advanceTimersByTimeAsync(1000)
		expect(binding.opened).toBe(true)
		expect(vi.getTimerCount()).toBe(0)
		finishRender()
		await vi.advanceTimersByTimeAsync(49)
		expect(binding.opened).toBe(true)
		await vi.advanceTimersByTimeAsync(1)
		expect(binding.opened).toBe(false)
	})

	it('allows null to disable auto hiding and zero to hide on the next tick', async () => {
		let binding = createTooltip()
		binding.update('Help', {autoHideDelay: null})
		binding.showPopup()
		await vi.advanceTimersByTimeAsync(10000)
		expect(binding.opened).toBe(true)
		expect(vi.getTimerCount()).toBe(0)
		binding.update('Help', {autoHideDelay: 0})
		expect(binding.opened).toBe(true)
		await vi.advanceTimersByTimeAsync(0)
		expect(binding.opened).toBe(false)
	})

	it('replaces a changed delay without extending it on ordinary updates', async () => {
		let binding = createTooltip()
		binding.update('Help', {autoHideDelay: 100})
		binding.showPopup()
		await vi.advanceTimersByTimeAsync(50)
		binding.update('Updated', {autoHideDelay: 200})
		await vi.advanceTimersByTimeAsync(100)
		binding.update('Updated again', {autoHideDelay: 200})
		await vi.advanceTimersByTimeAsync(99)
		expect(binding.opened).toBe(true)
		await vi.advanceTimersByTimeAsync(1)
		expect(binding.opened).toBe(false)
	})

	it.each([null, 'empty content'])('cancels an active countdown for %s', async change => {
		let binding = createTooltip()
		binding.update('Help', {autoHideDelay: 100})
		binding.showPopup()
		await vi.advanceTimersByTimeAsync(50)

		binding.update(change === null ? 'Help' : null, {
			autoHideDelay: change === null ? null : 100,
		})

		expect(vi.getTimerCount()).toBe(0)
	})

	it('restarts the countdown when cleared content is restored', async () => {
		let binding = createTooltip()
		binding.update('Help', {autoHideDelay: 100})
		binding.showPopup()
		await vi.advanceTimersByTimeAsync(50)
		binding.update(null, {autoHideDelay: 100})
		binding.update('Restored', {autoHideDelay: 100})
		await vi.advanceTimersByTimeAsync(99)
		expect(binding.opened).toBe(true)
		await vi.advanceTimersByTimeAsync(1)
		expect(binding.opened).toBe(false)
	})

	it('cancels on close and gives a reopened tooltip a fresh countdown', async () => {
		let binding = createTooltip()
		binding.update('Help', {autoHideDelay: 100})
		binding.showPopup()
		await vi.advanceTimersByTimeAsync(50)
		binding.hidePopup()
		expect(vi.getTimerCount()).toBe(0)
		binding.showPopup()
		await vi.advanceTimersByTimeAsync(99)
		expect(binding.opened).toBe(true)
		await vi.advanceTimersByTimeAsync(1)
		expect(binding.opened).toBe(false)
	})

	it.each([false, true])('cancels disconnect during %s pending rendering', async pending => {
		let binding = createTooltip()
		let finishRender!: () => void
		if (pending) {
			let rendering = new Promise<void>(resolve => { finishRender = resolve })
			vi.spyOn(binding as any, 'updatePopup').mockReturnValue(rendering)
		}

		binding.update('Help', {autoHideDelay: 100})
		binding.showPopup()
		await vi.advanceTimersByTimeAsync(0)
		binding.beforeDisconnectCallback()
		finishRender?.()
		await vi.advanceTimersByTimeAsync(0)
		expect(binding.opened).toBe(false)
		expect(vi.getTimerCount()).toBe(0)
	})

	it('cancels a delayed opening on disconnect', async () => {
		let binding = createTooltip()
		binding.update('Help', {showDelay: 100, autoHideDelay: 50})
		binding.showPopupLater()
		binding.beforeDisconnectCallback()
		await vi.advanceTimersByTimeAsync(200)
		expect(binding.opened).toBe(false)
		expect(vi.getTimerCount()).toBe(0)
	})

	it.each(['prompt', 'error'] as const)('auto hides persistent %s tooltips', async type => {
		let binding = createTooltip()
		binding.update('Help', {type, keepVisible: true, autoHideDelay: 100})
		await vi.advanceTimersByTimeAsync(0)
		expect(binding.opened).toBe(true)
		binding['onWillHide']()
		await vi.advanceTimersByTimeAsync(100)
		expect(binding.opened).toBe(false)
	})
})
