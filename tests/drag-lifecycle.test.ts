import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {draggable} from '../src/bindings/draggable'
import {DragMover} from '../src/bindings/drag-drop-helpers/drag-mover'
import {GlobalDragDropRelationship as relationship} from '../src/bindings/drag-drop-helpers/relationship'
import {DOMEvents} from 'lupos'
import {render} from 'lupos.html'


vi.mock('lupos', async importOriginal => ({
	...await importOriginal<typeof import('lupos')>(),
	DOMEvents: {on: vi.fn(), off: vi.fn()},
}))
vi.mock('lupos.html', () => ({render: vi.fn()}))
vi.mock('../src/tools/device', () => ({device: {touch: false}}))

vi.mock('../src/bindings/drag-drop-helpers/drag-placer', () => ({
	DragPlacer: class {
		canDrop() { return true }
		getInsertIndex() { return -1 }
		async endDragging() {}
	},
}))

vi.mock('../src/bindings/drag-drop-helpers/order-placer', () => ({OrderPlacer: class {}}))


/** Create a minimal element for lifecycle tests without browser layout. */
function element() {
	return {
		style: {visibility: ''},
		parentElement: null,
		getBoundingClientRect: () => ({x: 0, y: 0, width: 20, height: 20}),
		remove: vi.fn(),
	}
}

/** Create a cancelable pointer event for starting the drag. */
function pointer(clientX: number = 10) {
	return {
		type: 'pointermove',
		clientX,
		clientY: 10,
		pageX: clientX,
		pageY: 10,
		target: null,
		defaultPrevented: false,
		preventDefault() { this.defaultPrevented = true },
	} as unknown as PointerEvent
}

/** Configure a preview whose connection can be delayed. */
function preview(connection: Promise<void> = Promise.resolve()) {
	let indicator = element()
	let rendered = {
		el: {firstElementChild: indicator},
		connectManually: () => connection,
		remove: vi.fn(),
	}

	vi.mocked(render).mockReturnValueOnce(rendered as any)
	let drag = new draggable(element() as any, null)
	drag.update('item', {name: 'test', followElementRenderer: () => null})
	return {drag, rendered, indicator}
}


describe('drag lifecycle', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(render).mockReset()
		vi.stubGlobal('document', {body: {append: vi.fn()}, contains: () => true})
		vi.stubGlobal('window', {})

		vi.stubGlobal('DOMPoint', class {
			x: number
			y: number

			constructor(x: number, y: number) {
				this.x = x
				this.y = y
			}
		})
	})

	afterEach(async () => {
		await relationship.endDragging(true)
		vi.unstubAllGlobals()
	})

	it.each(['return false', 'prevent default'])('does not render a UI preview when cancelled by %s', async mode => {
		let {drag} = preview()
		drag.options.onStart = e => {
			if (mode === 'prevent default') {
				e.preventDefault()
				return true
			}
			else {
				return false
			}
		}

		expect(drag['onDragStart'](pointer())).toBe(false)
		expect(render).not.toHaveBeenCalled()
		expect(document.body.append).not.toHaveBeenCalled()
	})

	it('removes listeners immediately when handing off to a native drag', () => {
		let onEnd = vi.fn()
		let mover = new DragMover(false, () => false, onEnd)
		mover.setDragStart(pointer(0))
		mover['onPointerMove'](pointer(20))

		expect(DOMEvents.off).toHaveBeenCalledWith(document, 'pointermove', expect.any(Function), mover)
		expect(DOMEvents.off).toHaveBeenCalledWith(document, 'pointerup', expect.any(Function), mover)
		expect(onEnd).not.toHaveBeenCalled()
	})

	it('does not attach a preview that finishes rendering after release', async () => {
		let {promise, resolve} = Promise.withResolvers<void>()
		let {drag, rendered, indicator} = preview(promise)
		let started = relationship.startDragging(drag, pointer())
		await relationship.endDragging()
		resolve()
		await started

		expect(document.body.append).not.toHaveBeenCalled()
		expect(indicator.remove).toHaveBeenCalled()
		expect(rendered.remove).toHaveBeenCalled()
		expect(drag.el.style.visibility).toBe('')
	})

	it('removes the preview and restores the source after a normal drag', async () => {
		let {drag, rendered, indicator} = preview()
		await relationship.startDragging(drag, pointer())
		expect(document.body.append).toHaveBeenCalledWith(indicator)
		expect(drag.el.style.visibility).toBe('hidden')

		await relationship.endDragging()
		expect(indicator.remove).toHaveBeenCalled()
		expect(rendered.remove).toHaveBeenCalled()
		expect(drag.el.style.visibility).toBe('')
	})

	it('clears drop-area highlighting when a drag is cancelled', async () => {
		let {drag} = preview()
		await relationship.startDragging(drag, pointer())
		let drop = {fireDrop: vi.fn(), fireLeave: vi.fn()}
		relationship.activeDrop = drop as any

		await relationship.endDragging(true)
		expect(drop.fireDrop).not.toHaveBeenCalled()
		expect(drop.fireLeave).toHaveBeenCalledOnce()
	})

	it('cleans up even when a drop callback throws', async () => {
		let {drag, rendered, indicator} = preview()
		await relationship.startDragging(drag, pointer())
		relationship.activeDrop = {
			fireDrop: () => { throw new Error('drop failed') },
		} as any

		await expect(relationship.endDragging()).rejects.toThrow('drop failed')
		expect(rendered.remove).toHaveBeenCalled()
		expect(indicator.remove).toHaveBeenCalled()
		expect(drag.el.style.visibility).toBe('')
	})

	it('does not remove a newer preview while an older drag finishes', async () => {
		let first = preview()
		await relationship.startDragging(first.drag, pointer())
		let {promise, resolve} = Promise.withResolvers<void>()
		let placer = (relationship as any).placer
		placer.endDragging = () => promise
		let ending = relationship.endDragging()

		let second = preview()
		await relationship.startDragging(second.drag, pointer())
		resolve()
		await ending

		expect(first.indicator.remove).toHaveBeenCalled()
		expect(second.indicator.remove).not.toHaveBeenCalled()
		expect(second.rendered.remove).not.toHaveBeenCalled()
		expect(second.drag.el.style.visibility).toBe('hidden')
	})

	it('cancels without dropping when the pointer is cancelled or focus is lost', () => {
		let onEnd = vi.fn()
		let mover = new DragMover(false, () => true, onEnd)
		mover.setDragStart(pointer(0))
		mover['onPointerMove'](pointer(20))
		mover['onCancelled']()
		mover['onPointerUp']()

		expect(onEnd).toHaveBeenCalledExactlyOnceWith(true)
		expect(DOMEvents.on).toHaveBeenCalledWith(document, 'pointercancel', expect.any(Function), mover)
		expect(DOMEvents.on).toHaveBeenCalledWith(window, 'blur', expect.any(Function), mover)
	})
})
