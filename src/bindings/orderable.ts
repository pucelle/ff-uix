import {Binding, Part} from 'lupos.html'
import {DraggableBase, DraggableOptions} from './draggable'
import {DragMover} from './drag-drop-helpers/drag-mover'


export interface OrderableOptions extends Omit<DraggableOptions, 'persistStyleProperties'> {
	
	/** 
	 * Whether can slider only in x/y axis.
	 * If specifies as `true`, means can only swap with dragging element siblings.
	 */
	slideOnly?: boolean
}

const DefaultOrderableOptions: OrderableOptions = {
	name: '',
	slideOnly: false,
	autoScroll: false,
}


/** 
 * Make current element orderable, can drag it to swap order index among siblings.
 * 
 * :orderable=${data, index, ?options}
 * - `data`: Data item to identify current dragging item.
 * - `index`: Data item index within it's siblings.
 * - `options` Orderable options.
 * 
 * For bound element, you may need to set styles to prevent default selection and hold action:
 * `
 *  user-select: none;
 *	-webkit-user-select: none;
 *	-webkit-touch-callout: none;
 *  touch-action: none;
 * `
 * 
 * or
 * `@include non-select;`.
 */
export class orderable<T = any> extends DraggableBase<T> implements Binding, Part {

	readonly mode = 'order'
	override options: OrderableOptions = DefaultOrderableOptions

	protected override initMover(e: MouseEvent | TouchEvent) {
		
		// Not persist mover, this object is reuseable.
		let mover = new DragMover(
			this.options.slideOnly ?? false,
			this.onDragStart.bind(this),
			this.onDragEnd.bind(this)
		)

		mover.setDragStart(e)
	}

	update(data: T, index: number, options: Partial<DraggableOptions> = {}) {
		let dataChanged = data !== this.data

		this.data = data
		this.index = index
		this.options = {...DefaultOrderableOptions, ...options}

		if (dataChanged) {
			this.onDataChanged()
		}
	}
}