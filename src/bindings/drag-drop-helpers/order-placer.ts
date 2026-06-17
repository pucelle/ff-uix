import {Coord, DOMUtils, HVDirection, sleep} from 'ff-kit'
import {WebTransition, WebTransitionKeyFrame} from 'lupos.html'
import {droppable} from '../droppable'
import {DragPlacer} from './drag-placer'
import {orderable, OrderableOptions} from '../orderable'
import {DraggingProperties} from './types'


/** To handle items placement after drag over. */
export class OrderPlacer extends DragPlacer {

	declare protected readonly dragging: DraggingProperties<OrderableOptions>

	/** Elements that moves to right (never moves to left) in visually, compare to their auto layout position. */
	protected readonly elementsMoved: Map<HTMLElement, 0 | 1 | -1> = new Map()

	/** Dragging element width includes margin. */
	protected readonly outerWidth!: number

	/** Dragging element height includes margin. */
	protected readonly outerHeight!: number
	
	/** Where the dragging come from. */
	protected readonly startDrop: droppable | null

	/** 
	 * After mouse enter a drop area, we should insert a placeholder
	 * that having same size with dragging element into to make target drop
	 * size act as current dragging dropped.
	 */
	protected placeholder: HTMLElement | null = null

	/** Currently mouse entered draggable. */
	protected draggingTo: orderable | null = null

	/** 
	 * Currently mouse entered drop area.
	 * Term `droppable` is a little hard to understand, so use `drop area` instead.
	 */
	protected activeDrop: droppable | null = null

	/** Rect of `dragTo`. */
	protected draggingToRect: DOMRect | null = null

	/** Indicates the index of where to insert dragging element in the current drop area if drop right now. */
	protected draggingToIndex: number = -1

	/** Dragging element siblings growth direction. */
	protected itemsDirection: HVDirection = 'vertical'

	constructor(
		dragging: DraggingProperties<OrderableOptions>,
		draggingIndicator: HTMLElement,
		draggingIndicatorMode: 'cloned' | 'created',
		position: Coord,
		drop: droppable | null
	) {
		super(
			dragging,
			draggingIndicator,
			draggingIndicatorMode,
			position
		)

		this.startDrop = this.activeDrop = drop
		this.itemsDirection = drop?.options.itemsDirection ?? 'vertical'
	
		// Not consider about margin collapse.
		// Not consider about margin collapse.
		this.outerWidth = DOMUtils.getOuterWidth(dragging.el!)
		this.outerHeight = DOMUtils.getOuterHeight(dragging.el!)
	}

	/** 
	 * Try create a placeholder having same size with dragging element,
	 * and insert placeholder to droppable,
	 * to make target drop size act as current dragging dropped.
	 */
	protected tryInsertPlaceholderTo(drop: droppable) {
		if (!this.placeholder && this.dragging.el) {
			let placeholder = this.dragging.el.cloneNode() as HTMLElement
			let elRect = this.dragging.rect

			// May anchor aligning on it.
			placeholder?.style.removeProperty('anchor-name')

			placeholder.style.visibility = 'hidden'
			placeholder.style.width = elRect.width + 'px'
			placeholder.style.height = elRect.height + 'px'

			this.placeholder = placeholder
		}

		// Add a placeholder to persist parent container size.
		if (this.placeholder) {
			drop.el.append(this.placeholder)
		}
	}

	/** Walk for sibling elements after `fromEl`. */
	protected *walkSelfAndSiblingsAfter(fromEl: HTMLElement, readCount: number = Infinity): Iterable<HTMLElement> {
		let count = 0

		for (let el = fromEl; el; el = el.nextElementSibling as HTMLElement) {
			yield el
			count++

			if (count >= readCount) {
				break
			}
		}
	}

	/** Walk for sibling elements before `fromEl`. */
	protected *walkSelfAndSiblingsBefore(fromEl: HTMLElement, readCount: number = Infinity): Iterable<HTMLElement> {
		let count = 0

		for (let el = fromEl; el; el = el.previousElementSibling as HTMLElement) {
			yield el
			count++

			if (count >= readCount) {
				break
			}
		}
	}

	/** Play movement transition. */
	protected async playTransitionTo(el: HTMLElement, endFrame: WebTransitionKeyFrame) {
		let transition = new WebTransition(el, {
			duration: this.dragging.options.transitionDuration ?? WebTransition.DefaultOptions.duration,
			easing: this.dragging.options.transitionEasing ?? WebTransition.DefaultOptions.easing,
		})
	
		el.style.pointerEvents = 'none'

		// `none` is transition-able.
		if (endFrame.transform === '') {
			endFrame.transform = 'none'
		}

		let finish = await transition.playTo(endFrame, true)
		if (finish) {

			// When mouse on target, it soon slider, but may immediately
			// trigger a backward sliding after transition end.
			// So here we provide a safe time distance.
			sleep(500).then(() => el.style.pointerEvents = '')

			if (endFrame.transform === 'none') {
				el.style.transform = ''
			}
		}
	}

	override onEnterDrag(drag: orderable) {
		if (!this.activeDrop) {
			return
		}

		let atSameDropArea = this.startDrop === this.activeDrop
		let elementsWillMove: Map<HTMLElement, 0 | 1 | -1> = new Map()

		if (atSameDropArea) {

			// Drag to higher index, move to left.
			// Note in a partial rendering system, `this.dragging.el` may get reused,
			// so here we use a index difference for locating the range.
			if (drag.index > this.dragging.index) {
				for (let el of this.walkSelfAndSiblingsBefore(drag.el, drag.index - this.dragging.index)) {
					elementsWillMove.set(el, -1)
				}
			}

			// Drag to lower index, move to right.
			else {
				for (let el of this.walkSelfAndSiblingsAfter(drag.el, this.dragging.index - drag.index)) {
					elementsWillMove.set(el, 1)
				}
			}
		}
		else {

			// Moves right.
			for (let el of this.walkSelfAndSiblingsAfter(drag.el)) {
				elementsWillMove.set(el, 1)
			}

			// No need to move placeholder
			if (this.placeholder) {
				elementsWillMove.delete(this.placeholder)
			}
		}

		// When the dragged into element has been moved,
		// dragged into it again means that it's movement will be restored.
		if (this.elementsMoved.has(drag.el)) {
			elementsWillMove.delete(drag.el)
		}

		// Persist position.
		for (let el of [...this.elementsMoved.keys()]) {
			if (!elementsWillMove.has(el)) {
				this.moveElement(el, 0, true)
			}
		}

		// Moves if not yet or different.
		for (let [el, moves] of elementsWillMove) {
			if (this.elementsMoved.get(el) !== moves) {
				this.moveElement(el, moves, true)
			}
		}

		this.draggingTo = drag
		this.draggingToRect = drag.el.getBoundingClientRect()
		this.draggingToIndex = this.calcDraggingToIndex(drag, elementsWillMove.has(drag.el))
	}

	/** 
	 * Moves one element based on a move direction to giver space for dragging item.
	 * @param moveDirection `1` to move right or bottom, `-1` to move left or top, `0` to keep still.
	 */
	protected moveElement(el: HTMLElement, moveDirection: -1 | 1 | 0, playTransition: boolean) {
		let movePx = this.itemsDirection === 'horizontal' ? this.outerWidth : this.outerHeight
		let translateDirection = moveDirection
		let transformProperty = this.itemsDirection === 'vertical' ? 'translateY' : 'translateX'
		let translatePixels = translateDirection * movePx

		let transform = translateDirection !== 0
			? `${transformProperty}(${translatePixels}px)`
			: ''

		if (playTransition) {
			this.playTransitionTo(el, {transform})
		}
		else {
			el.style.transform = transform
		}

		if (moveDirection !== 0) {
			this.elementsMoved.set(el, moveDirection)
		}
		else {
			this.elementsMoved.delete(el)
		}
	}

	/** Compute at which index of the target data list should insert if drop here. */
	protected calcDraggingToIndex(drag: orderable, dragElAlreadyMoved: boolean): number {
		let atSameDropArea = this.startDrop === this.activeDrop
		let index = drag.index

		// Assume we have:
		//	 group 1: 1 2 3
		//   group 2: 4 5 6

		if (atSameDropArea) {

			// Drag 1 into 3
			if (index > this.dragging.index) {
				if (dragElAlreadyMoved) {

					// 2 3 [1]
					return index + 1
				}
				else {
					// 2 [1] 3
					return index
				}
			}

			// Drag 3 into 1
			else {
				if (dragElAlreadyMoved) {

					// [3] 1 2
					return index
				}
				else {
					// 1 [3] 2
					return index + 1
				}
			}
		}

		// Drag 1 into 4
		else {
			if (dragElAlreadyMoved) {
				return index	// [1] 4 5 6, returns index of 4
			}
			else {
				return index + 1	// 4 [1] 5 6, returns index of 4 + 1
			}
		}
	}

	override translateDraggingElement(moves: Coord, e: MouseEvent) {
		this.translate = moves

		if (this.dragging.options.slideOnly) {
			if (this.itemsDirection === 'vertical') {
				moves.x = 0
			}
			else {
				moves.y = 0
			}
		}
		
		super.translateDraggingElement(moves, e)
	}

	override onEnterDrop(drop: droppable) {

		// May active a different droppable, need to restore movements.
		if (drop !== this.activeDrop && this.activeDrop) {
			this.onLeaveDrop(this.activeDrop)
		}

		this.activeDrop = drop
		this.itemsDirection = drop.options.itemsDirection ?? 'vertical'

		if (drop !== this.startDrop) {
			this.tryInsertPlaceholderTo(drop)
		}
	}
	
	override onLeaveDrop(drop: droppable) {
		if (drop !== this.activeDrop) {
			return
		}

		this.restoreMovedElements(true)
		this.placeholder?.remove()
		
		this.activeDrop = null
		this.draggingTo = null
		this.draggingToRect = null
		this.draggingToIndex = -1
	}

	override canDrop(): boolean {
		return !!(
			this.draggingTo

				// Can drop to a new droppable even have no siblings entered.
				|| this.activeDrop && this.startDrop !== this.activeDrop
		)
	}

	/** Get the index where in droppable to insert dragging item. */
	override getInsertIndex(): number {
		return this.draggingToIndex
	}

	override async endDragging() {

		// Transition dragging element to drop area.
		if (this.canDrop()) {
			await this.transitionDraggingIndicatorToDropArea()
			this.draggingIndicator.style.transform = ''
		}

		// Transition dragging indicator to it's original position.
		else {
			await this.playTransitionTo(this.draggingIndicator, {transform: ''})
		}

		this.restoreMovedElements(false)
		this.placeholder?.remove()
		this.clearDraggingStyle()
	}

	/** Transition dragging element to where it dropped. */
	protected async transitionDraggingIndicatorToDropArea() {
		let fromRect = this.draggingIndicator.getBoundingClientRect()
		let toRect = this.draggingToRect || this.placeholder!.getBoundingClientRect()

		let x = toRect.left - fromRect.left + this.translate.x
		let y = toRect.top - fromRect.top + this.translate.y

		if (this.itemsDirection === 'horizontal') {

			// Move from left to right, align at right.
			if (this.dragging.index < this.draggingToIndex) {
				x = toRect.right - fromRect.right + this.translate.x
			}

			if (this.dragging.options.slideOnly) {
				y = 0
			}
		}
		else {
			// Move from top to bottom, align at bottom.
			if (this.dragging.index < this.draggingToIndex) {
				y = toRect.bottom - fromRect.bottom + this.translate.y
			}

			if (this.dragging.options.slideOnly) {
				x = 0
			}
		}

		let transform = `translate(${x}px, ${y}px)`

		await this.playTransitionTo(this.draggingIndicator, {transform})
	}

	/** Restore all moved and also translated elements. */
	protected restoreMovedElements(playTransition: boolean) {
		for (let el of this.elementsMoved.keys()) {
			if (playTransition) {
				this.playTransitionTo(el, {transform: ''})
			}
			else {
				el.style.transform = ''
			}
		}

		// Set a new set would be faster, but it's not performance sensitive here.
		this.elementsMoved.clear()
	}
}