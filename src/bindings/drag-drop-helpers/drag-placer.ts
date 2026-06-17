import {Coord, DOMUtils, HVDirection, ScrollUtils} from 'ff-kit'
import {DraggableBase, DraggableOptions} from '../draggable'
import {droppable} from '../droppable'
import {EdgeMoveTimer} from '../../tools/edge-move-timer'
import {DraggingProperties} from './types'


/** To handle items placement after drag over. */
export class DragPlacer {
	
	/** Dragging draggable. */
	protected readonly dragging: DraggingProperties<DraggableOptions>

	/** Dragging element. */
	protected readonly draggingIndicator: HTMLElement

	/** Whether the dragging el is cloned. */
	protected draggingIndicatorMode: 'cloned' | 'created'

	/** Dragging element translate. */
	protected translate: Coord = {x: 0, y: 0}

	/** Scroll wrapper. */
	protected scroller: HTMLElement | null = null

	/** Scroll direction. */
	protected scrollDirection: HVDirection | null = null

	/** Scroll position. */
	protected scrollerPosition: number = 0

	/** To do timer after mouse leaves edge. */
	protected edgeTimer: EdgeMoveTimer | null = null

	constructor(
		dragging: DraggingProperties<DraggableOptions>,
		draggingEl: HTMLElement,
		draggingElMode: 'cloned' | 'created',
		mousePosition: Coord
	) {
		this.dragging = dragging
		this.draggingIndicator = draggingEl
		this.draggingIndicatorMode = draggingElMode

		this.setGlobalDraggingStyle()

		if (draggingElMode) {
			this.setSelfDraggingStyle(mousePosition)
		}

		if (dragging.options.autoScroll) {
			this.initEdgeScroller()
		}
	}

	/** Apply mouse position to dragging followed. */
	protected setGlobalDraggingStyle() {
		document.body.style.cursor = 'grabbing'
		document.body.style.userSelect = 'none'
	}

	/** Set dragging style for dragging element. */
	protected setSelfDraggingStyle(mousePosition: Coord) {
		let elMarginVector = {
			x: DOMUtils.getNumericStyleValue(this.dragging.el!, 'marginLeft'),
			y: DOMUtils.getNumericStyleValue(this.dragging.el!, 'marginTop'),
		}

		this.draggingIndicator.style.position = 'fixed'
		this.draggingIndicator.style.left = mousePosition.x - elMarginVector.x + 'px'
		this.draggingIndicator.style.top = mousePosition.y - elMarginVector.y + 'px'

		this.draggingIndicator.style.zIndex = '9999'
		this.draggingIndicator.style.boxShadow = `0 0 var(--popup-shadow-blur-radius) var(--popup-shadow-color)`
		this.draggingIndicator.style.pointerEvents = 'none'
		this.draggingIndicator.style.willChange = 'transform'
	}

	/** Init scroller if need. */
	protected initEdgeScroller() {
		let wrapperAndDirection = ScrollUtils.findClosestCSSScrollWrapper(this.dragging.el!)

		if (wrapperAndDirection) {
			this.scroller = wrapperAndDirection.wrapper
			this.scrollDirection = wrapperAndDirection.direction

			this.scrollerPosition = this.scrollDirection === 'vertical' ? this.scroller.scrollTop
				: this.scrollDirection === 'horizontal' ? this.scroller.scrollLeft
				: 0

			this.edgeTimer = new EdgeMoveTimer(this.scroller, {padding: 0})
			this.edgeTimer.onUpdate = this.onEdgeTimerUpdate.bind(this)
		}
	}

	/** When mouse enter draggable. */
	onEnterDrag(_drag: DraggableBase) {}

	/** When mouse enter droppable. */
	onEnterDrop(_drop: droppable) {}
	
	/** When mouse leaves drop area. */
	onLeaveDrop(_drop: droppable) {}

	/** Translate dragging element follow mouse. */
	translateDraggingElement(moves: Coord, e: MouseEvent) {
		this.translate = moves
		this.draggingIndicator.style.transform = `translate(${moves.x}px, ${moves.y}px)`
		this.edgeTimer?.updateEvent(e)
	}

	/** Whether can drop to currently active drop. */
	canDrop(): boolean {
		return true
	}

	/** Returns the index of the inserting index of drop area. */
	getInsertIndex(): number {
		return -1
	}

	protected onEdgeTimerUpdate(moves: Coord, frameTime: number) {
		if (!this.scroller) {
			return
		}

		if (this.scrollDirection === 'vertical') {
			if (moves.y !== 0) {
				let clientSize = this.scroller.clientHeight
				let scrollSize = this.scroller.scrollHeight
				let scrollPosition = this.scrollerPosition + this.getIncrementalMovement(moves.y, frameTime)

				scrollPosition = Math.max(scrollPosition, 0)
				scrollPosition = Math.min(scrollPosition, scrollSize - clientSize)

				if (scrollPosition !== this.scrollerPosition) {
					this.scrollerPosition = scrollPosition
					this.scroller.scrollTop = scrollPosition
				}
			}
		}
		else if (this.scrollDirection === 'horizontal') {
			if (moves.x !== 0) {
				let clientSize = this.scroller.clientWidth
				let scrollSize = this.scroller.scrollWidth
				let scrollPosition = this.scrollerPosition + this.getIncrementalMovement(moves.x, frameTime)
				
				scrollPosition = Math.max(scrollPosition, 0)
				scrollPosition = Math.min(scrollPosition, scrollSize - clientSize)

				if (scrollPosition !== this.scrollerPosition) {
					this.scrollerPosition = scrollPosition
					this.scroller.scrollLeft = scrollPosition
				}
			}
		}
	}

	protected getIncrementalMovement(move: number, frameTime: number) {

		// Equals every frame moves by half `move`.
		return move * frameTime / 16.66 / 2
	}

	/** End dragging and play drag end transition. */
	async endDragging() {
		this.clearDraggingStyle()
	}

	/** Clear dragging style for dragging element. */
	protected clearDraggingStyle() {
		document.body.style.cursor = ''
		document.body.style.userSelect = ''
	}
}