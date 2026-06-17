import {DOMEvents} from 'lupos'
import {Coord, EventUtils} from 'ff-kit'
import {GlobalDragDropRelationship} from './relationship'
import {device} from '../../tools/device'
import {getDraggableByElement, getDroppableByElement} from './all-draggable'
import {DraggableBase} from '../draggable'
import {droppable} from '../droppable'


/** To help to bind the event handlings after started dragging. */
export class DragMover {

	readonly slideOnly: boolean
	readonly onDragStart: (e: PointerEvent | TouchEvent) => void
	readonly onDragEnd: () => void
	protected inDragging: boolean = false
	protected startPosition: DOMPoint | null = null
	protected currentlyEntered: Element | null = null
	protected currentDraggable: Set<DraggableBase> | null = null
	protected currentDroppable: Set<droppable> | null = null
	protected slideDirection: 'vertical' | 'horizontal' | null = null

	constructor(
		slideOnly: boolean,
		onDragStart: (e: PointerEvent | TouchEvent) => void,
		onDragEnd: () => void
	) {
		this.slideOnly = slideOnly
		this.onDragStart = onDragStart
		this.onDragEnd = onDragEnd
	}

	/** After mousedown or touch start. */
	setDragStart(e: MouseEvent | TouchEvent) {
		e.preventDefault()

		this.inDragging = false
		this.startPosition = EventUtils.getClientPosition(e)
	
		DOMEvents.on(document, 'pointermove', this.onPointerMove, this)
		DOMEvents.on(document, 'pointerup', this.onPointerUp, this)

		// If hold to start, start dragging immediately, no need to move a little.
		if (device.touch) {
			this.inDragging = true
			this.doEnterChecking(e as TouchEvent)

			// `onDragStart` requires active drop, so must after enter checking.
			this.onDragStart(e as TouchEvent)
		}
	}

	protected onPointerMove(e: PointerEvent) {
		if (e.defaultPrevented) {
			this.endDragging()
			return
		}

		e.preventDefault()
		
		let currentPosition = EventUtils.getClientPosition(e)

		let moves: Coord = {
			x: currentPosition.x - this.startPosition!.x,
			y: currentPosition.y - this.startPosition!.y,
		}

		if (!this.inDragging) {
			let movesLength = Math.sqrt(moves.x ** 2 + moves.y ** 2)
			if (movesLength > 5) {
				this.startPosition = currentPosition

				this.inDragging = true
				this.onDragStart(e)
			}
		}
		else {
			GlobalDragDropRelationship.translateDraggingIndicator(moves, e)
		}

		this.doEnterChecking(e)
	}

	protected doEnterChecking(e: PointerEvent | TouchEvent) {
		let target = e.target as Element | null

		// For touch device, either pointermove or touchmove,
		// event target is originally entered element.
		if (device.touch || this.slideDirection !== null) {
			let position = EventUtils.getClientPosition(e)

			if (this.slideDirection === 'vertical') {
				position.x = this.startPosition!.x
			}
			else if (this.slideDirection === 'horizontal') {
				position.y = this.startPosition!.y
			}

			target = document.elementFromPoint(position.x, position.y)
		}

		if (!target || target === this.currentlyEntered) {
			return
		}

		let newDraggable: Set<DraggableBase> = new Set()
		let newDroppable: Set<droppable> = new Set()

		for (let el: HTMLElement | null = target as HTMLElement; el; el = el.parentElement) {
			let draggable = getDraggableByElement(el)
			if (draggable) {
				newDraggable.add(draggable)
			}

			let droppable = getDroppableByElement(el)
			if (droppable) {
				newDroppable.add(droppable)
			}
		}


		// Must enter drag firstly, drop will valid dragging when entering.
		for (let draggable of newDraggable) {
			if (!this.currentDraggable?.has(draggable)) {
				GlobalDragDropRelationship.enterDrag(draggable)
			}
		}


		if (this.currentDroppable) {
			for (let droppable of this.currentDroppable) {
				if (!newDroppable.has(droppable)) {
					GlobalDragDropRelationship.leaveDrop(droppable)
				}
			}
		}
		
		for (let droppable of newDroppable) {
			if (!this.currentDroppable?.has(droppable)) {
				GlobalDragDropRelationship.enterDrop(droppable)
				if (this.slideOnly) {
					this.slideDirection = droppable.options.itemsDirection ?? 'vertical'
				}
			}
		}
		

		this.currentlyEntered = target
		this.currentDraggable = newDraggable
		this.currentDroppable = newDroppable
	}

	protected onPointerUp() {
		this.endDragging()
	}

	protected endDragging() {
		DOMEvents.off(document, 'pointermove', this.onPointerMove, this)
		DOMEvents.off(document, 'pointerup', this.onPointerUp, this)

		if (this.inDragging) {
			this.onDragEnd()
			this.currentlyEntered = null
			this.currentDraggable = null
			this.currentDroppable = null
			this.inDragging = false
		}
	}
}

