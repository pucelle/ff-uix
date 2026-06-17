import {DraggableOptions} from '../draggable'
import {OrderableOptions} from '../orderable'


/** 
 * Original dragging object may be reused.
 * So here it should extract properties to a unique object.
 */
export interface DraggingProperties<T extends DraggableOptions | OrderableOptions = DraggableOptions | OrderableOptions> {
	
	/** 
	 * Element may be disappeared after being reused.
	 * Such it get reset to `null`.
	 */
	el: HTMLElement | null

	/** Container of el. */
	readonly container: HTMLElement

	/** Rect of el. */
	readonly rect: DOMRect

	/** Drag or order. */
	readonly mode: string

	/** Draggable options. */
	readonly options: T

	/** Data can be passed to droppable. */
	readonly data: T | null

	/** Draggable index between siblings. */
	readonly index: number
}
