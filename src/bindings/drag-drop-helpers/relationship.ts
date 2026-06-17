import {Box, Coord, DOMUtils, EventUtils} from 'ff-kit'
import {DraggableBase, DraggableOptions} from '../draggable'
import {droppable} from '../droppable'
import {OrderPlacer} from './order-placer'
import {DragPlacer} from './drag-placer'
import {render, RenderedComponentLike} from 'lupos.html'
import {orderable} from '../orderable'
import {DraggingProperties} from './types'



/** Global manager to relate current dragging and it's droppable.  */
class DragDropRelationship {

	/** Currently dragging properties. */
	protected dragging: DraggingProperties | null = null

	/** Help to manage placement. */
	protected placer: DragPlacer | OrderPlacer | null = null

	/** 
	 * May mouse enter in several drop areas, and start dragging,
	 * then we need to check which drop area should trigger enter.
	 */
	protected enteredDroppable: Set<droppable> = new Set()

	/** Element to following dragging. */
	protected draggingIndicator: HTMLElement | null = null
	
	/** Rendered follow element. */
	protected followElementRendered: RenderedComponentLike<any> | null = null

	/** 
	 * Current drop area.
	 * Readonly outside.
	 */
	activeDrop: droppable | null = null

	/** When start dragging a draggable. */
	async startDragging(dragging: DraggableBase, e: PointerEvent | TouchEvent) {
		this.dragging = {
			el: dragging.el,
			container: dragging.el.parentElement!,
			rect: dragging.el.getBoundingClientRect(),
			mode: dragging.mode,
			options: dragging.options,
			data: dragging.data,
			index: dragging.index,
		}

		let activeDrop = this.findActiveDrop(dragging)
		activeDrop?.fireEnter(this.dragging)
		this.activeDrop = activeDrop

		let {indicator, mode} = await this.createDraggingIndicator()

		// When cloned, we prefer align with raw element.
		let position: Coord = mode === 'cloned'
			? this.dragging.rect
			: EventUtils.getPagePosition(e)

		this.initDraggingIndicatorStyle(indicator, mode)
		this.draggingIndicator = indicator

		if (dragging.mode === 'order') {
			this.placer = new OrderPlacer(this.dragging, indicator, mode, position, activeDrop)
		}
		else {
			this.placer = new DragPlacer(this.dragging, indicator, mode, position)
		}

		dragging.el.style.visibility = 'hidden'
		document.body.append(indicator)
	}

	protected findActiveDrop(dragging: DraggableBase): droppable | null {
		let activeDrop: droppable | null = null
		let draggingArea = Box.fromLike(this.dragging!.rect)

		for (let drop of [...this.enteredDroppable]) {

			// May element was removed.
			if (!document.contains(drop.el)) {
				this.enteredDroppable.delete(drop)
				continue
			}

			// Sometimes if drop area shrink immediately, will not trigger leaving.
			let dropArea = Box.fromLike(drop.el.getBoundingClientRect())
			if (!draggingArea.isIntersectWith(dropArea)) {
				this.enteredDroppable.delete(drop)
				continue
			}

			if (drop.options.name === dragging.options.name
				|| Array.isArray(dragging.options.name) && dragging.options.name.includes(drop.options.name)
			) {
				activeDrop = drop
				break
			}
		}

		return activeDrop
	}

	protected async createDraggingIndicator() {
		let el = this.dragging!.el!
		let elRenderer = this.dragging!.options.followElementRenderer
		let indicator: HTMLElement | null = null
		let mode: 'cloned' | 'created'

		if (elRenderer) {
			let rendered = this.followElementRendered = render(elRenderer)
			await rendered.connectManually()

			indicator = rendered.el.firstElementChild as HTMLElement | null
				?? el.cloneNode(true) as HTMLElement

			mode = 'created'
		}

		// tr isn't easy to clone, must clone table, colgroup also.
		else if (el.localName === 'tr') {
			let table = el.closest('table')
			if (table) {
				indicator = table.cloneNode() as HTMLElement
	
				let colGroup = table.querySelector('colgroup')
				if (colGroup) {
					indicator.append(colGroup.cloneNode(true))
				}

				let tr = el.cloneNode(true)
				indicator.append(tr)
			}
			else {
				indicator = el.cloneNode(true) as HTMLElement
			}

			mode = 'cloned'
		}

		else {
			indicator = el.cloneNode(true) as HTMLElement
			mode = 'cloned'
		}

		return {
			indicator,
			mode,
		}
	}

	protected initDraggingIndicatorStyle(indicator: HTMLElement, mode: 'cloned' | 'created') {
		let dragging = this.dragging!

		if (mode === 'cloned') {
			indicator.style.width = this.dragging!.rect.width + 'px'
			indicator.style.height = this.dragging!.rect.height + 'px'
		}
		else if ((dragging.options as DraggableOptions).persistStyleProperties) {
			for (let styleName of (dragging.options as DraggableOptions).persistStyleProperties!) {
				indicator.style.setProperty(styleName, DOMUtils.getStyleValue(dragging.el!, styleName))
			}
		}

		if (dragging.options.draggingClassName) {
			indicator.classList.add(...dragging.options.draggingClassName.split(' '))
		}
	}

	/** Translate dragging element to keep follows with mouse. */
	translateDraggingIndicator(moves: Coord, e: MouseEvent) {
		this.placer?.translateDraggingElement(moves, e)
	}

	/** After raw dragging element get reused and leaves it's data. */
	tryUpdateDraggingEl(el: HTMLElement, data: any, index: number) {
		let dragging = this.dragging
		if (!dragging || dragging.container !== el.parentElement) {
			return
		}

		if (dragging.data === data && dragging.index === index) {
			dragging.el = el
			el.style.visibility = 'hidden'
		}
		else if (el === dragging.el
			&& !(dragging.data === data && dragging.index === index)
		) {
			dragging.el = null
			el.style.visibility = ''
		}
	}

	/** When dragging and enter a draggable. */
	enterDrag(drag: DraggableBase) {
		if (this.canEnterToSwapWith(drag)) {
			this.placer?.onEnterDrag(drag)
		}
	}

	/** Whether dragging can swap with draggable. */
	protected canEnterToSwapWith(drag: DraggableBase): drag is orderable {
		return !!(
			this.dragging
				&& this.dragging.mode === 'order'
				&& this.dragging.options.name === drag.options.name
				&& !(this.dragging.data === drag.data && this.dragging.index === drag.index)
		)
	}

	/** 
	 * When dragging and enter a droppable.
	 * Returns whether entered.
	 */
	enterDrop(dropping: droppable): boolean {
		this.enteredDroppable.add(dropping)

		if (this.canDropTo(dropping)) {
			dropping.fireEnter(this.dragging!)
			this.activeDrop = dropping
			this.placer?.onEnterDrop(dropping)

			return true
		}

		return false
	}

	/** Whether dragging can drop to a droppable. */
	protected canDropTo(drop: droppable): boolean {
		let dragging = this.dragging

		if (!dragging) {
			return false
		}

		if (Array.isArray(dragging.options.name)) {
			if (!dragging.options.name.includes(drop.options.name)) {
				return false
			}
		}
		else {
			if (dragging.options.name !== drop.options.name) {
				return false
			}
		}

		if (dragging.el === drop.el) {
			return false
		}

		if (drop.options.canDrop) {
			if (!drop.options.canDrop(dragging.data)) {
				return false
			}
		}

		return true
	}

	/** When dragging and leave a droppable. */
	leaveDrop(dropping: droppable) {
		this.enteredDroppable.delete(dropping)

		// When can auto scroll, not fires leave.
		if (this.activeDrop === dropping) {
			dropping.fireLeave(this.dragging!)
			this.placer?.onLeaveDrop(dropping)
			this.activeDrop = null
		}
	}

	/** When release dragging. */
	async endDragging() {
		if (!this.dragging) {
			return
		}

		let dragging = this.dragging
		let movement = this.placer
		let activeDrop = this.activeDrop

		this.dragging = null
		this.placer = null
		this.activeDrop = null

		// No need to call `leaveDrop` here.
		// Play leave transition firstly.
		if (movement) {
			let canDrop = movement.canDrop() && activeDrop
			let insertIndex = movement.getInsertIndex()

			await movement.endDragging()
			
			if (canDrop) {
				activeDrop!.fireDrop(dragging, insertIndex)
			}
		}

		// Then recycle elements.
		if (dragging.el) {
			dragging.el.style.visibility = ''
		}

		if (this.followElementRendered) {
			this.followElementRendered.remove()
			this.followElementRendered = null
		}

		// Not remove it here
		if (this.draggingIndicator) {
			this.draggingIndicator.remove()
			this.draggingIndicator = null
		}
	}
}

export const GlobalDragDropRelationship = /*#__PURE__*/new DragDropRelationship()
