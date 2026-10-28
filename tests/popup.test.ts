import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {PopupStacker} from 'ff-kit'


vi.mock('../src/bindings/popup-helpers/popup-binder', () => ({
	PopupTriggerBinder: class {
		trigger = 'hover'
		clickToHide = false
		bindEnter = vi.fn()
		unbindEnter = vi.fn()
		bindLeaveBeforeShow = vi.fn()
		setTriggerType = vi.fn((trigger: string) => this.trigger = trigger)
		setMatchSelector = vi.fn()
	},
}))

import {popup} from '../src/bindings/popup'
import * as SharedPopups from '../src/bindings/popup-helpers/shared-popups'


/** Exercise popup state without requiring DOM rendering or transitions. */
class TestPopup extends popup {
	shows = vi.fn()
	hides = vi.fn()

	protected override async doShow() {
		this.shows()
	}

	protected override async doHide(immediately: boolean) {
		this.hides(immediately)
	}

	/** Skip DOM rendering in state-transition tests. */
	protected override async updatePopup(_showImmediately: boolean) {}
}


/** Create a binding with a minimal trigger element. */
function createPopup() {
	return new TestPopup({} as Element, {})
}


describe('popup binding', () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.restoreAllMocks()
		vi.useRealTimers()
	})

	it('merges options and binds the configured trigger on connection', async () => {
		let binding = createPopup()
		binding.update(() => null, {trigger: 'click', autoHide: true, matchSelector: '.item'})
		await binding.afterConnectCallback()

		expect(binding['options']).toMatchObject({position: 'b', hideDelay: 100, trigger: 'click'})
		expect(binding['binder'].clickToHide).toBe(true)
		expect(binding['binder'].setTriggerType).toHaveBeenCalledWith('click')
		expect(binding['binder'].setMatchSelector).toHaveBeenCalledWith('.item')
		expect(binding['binder'].bindEnter).toHaveBeenCalledOnce()
	})

	it('does not open without content and opens only once when requested repeatedly', () => {
		let binding = createPopup()
		binding.showPopup()
		expect(binding.opened).toBe(false)
		binding.update(() => null)
		binding.showPopup()
		binding.showPopup()
		expect(binding.opened).toBe(true)
		expect(binding.shows).toHaveBeenCalledOnce()
	})

	it('delays hover opening and cancels it on leave before showing', () => {
		let binding = createPopup()
		binding.update(() => null, {showDelay: 100})
		binding.showPopupLater()
		expect(binding['binder'].bindLeaveBeforeShow).toHaveBeenCalledOnce()
		vi.advanceTimersByTime(99)
		expect(binding.opened).toBe(false)
		binding['onCancelShow']()
		vi.advanceTimersByTime(1)
		expect(binding.shows).not.toHaveBeenCalled()
	})

	it('uses no show delay for click triggers or reusable open popups', async () => {
		let cached = vi.spyOn(SharedPopups, 'isCacheOpened').mockReturnValue(true)
		let binding = createPopup()
		binding.update(() => null, {showDelay: 100, key: 'shared'})
		binding.showPopupLater()
		vi.advanceTimersByTime(0)
		expect(binding.opened).toBe(true)
		expect(cached).toHaveBeenCalledWith('shared')

		let clicked = createPopup()
		clicked.update(() => null, {showDelay: 100, trigger: 'click'})
		await clicked.afterConnectCallback()
		clicked.showPopupLater()
		vi.advanceTimersByTime(0)
		expect(clicked.opened).toBe(true)
	})

	it('cancels a pending hide when showing again', () => {
		let binding = createPopup()
		let leave = vi.spyOn(PopupStacker, 'onLeave').mockImplementation(() => {})
		binding.update(() => null, {hideDelay: 100})
		binding.showPopup()
		binding.hidePopupLater()
		expect(leave).toHaveBeenCalledWith(binding.el)
		vi.advanceTimersByTime(50)
		binding.showPopup()
		vi.advanceTimersByTime(100)
		expect(binding.opened).toBe(true)
		expect(binding.hides).not.toHaveBeenCalled()
	})

	it('hides after the configured delay and unbinds on disconnect', () => {
		let binding = createPopup()
		vi.spyOn(PopupStacker, 'onLeave').mockImplementation(() => {})
		binding.update(() => null, {hideDelay: 25})
		binding.showPopup()
		binding.hidePopupLater()
		vi.advanceTimersByTime(24)
		expect(binding.opened).toBe(true)
		vi.advanceTimersByTime(1)
		expect(binding.opened).toBe(false)
		expect(binding.hides).toHaveBeenCalledWith(false)
		binding.beforeDisconnectCallback()
		expect(binding['binder'].unbindEnter).toHaveBeenCalledOnce()
	})

	it('keeps visible popups open on trigger leave until the option is removed', () => {
		let binding = createPopup()
		binding.update(() => null, {keepVisible: true})
		vi.advanceTimersByTime(0)
		expect(binding.opened).toBe(true)
		binding['onWillHide']()
		vi.advanceTimersByTime(200)
		expect(binding.opened).toBe(true)
		binding.update(() => null, {keepVisible: false})
		expect(binding.opened).toBe(false)
	})

	it('only allows keyed reuse when unlocked and not kept visible', () => {
		let binding = createPopup()
		let locked = vi.spyOn(PopupStacker, 'hasLocked').mockReturnValue(true)
		binding.update(() => null)
		expect(binding.canPopupReuse()).toBe(false)
		binding.update(() => null, {key: 'shared'})
		binding.showPopup()
		expect(binding.canPopupReuse()).toBe(false)
		locked.mockReturnValue(false)
		expect(binding.canPopupReuse()).toBe(true)
		binding.update(() => null, {key: 'shared', keepVisible: true})
		expect(binding.canPopupReuse()).toBe(false)
	})
})
