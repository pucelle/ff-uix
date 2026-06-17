import {Binding, Part, PartCallbackParameterMask, RenderResultRenderer, WebTransitionEasingName} from 'lupos.html'
import {DOMEvents} from 'lupos'
import {GlobalDragDropRelationship} from './drag-drop-helpers/relationship'
import {droppable} from './droppable'
import {DragMover} from './drag-drop-helpers/drag-mover'
import {device} from '../tools/device'
import {SimulatedEvents} from 'ff-kit'
import {registerDraggable, unregisterDraggable} from './drag-drop-helpers/all-draggable'


export interface DraggableOptions {
	
	/** `name` for draggable, can drop to droppable only when name match. */
	name: string

	/** 
	 * By default, dragging will be started if drag start from the element bounded.
	 * By specifying `matchSelector`, can limit from only the element match this selector.
	 */
	matchSelector?: string

	/** The class name to apply after start dragging. */
	draggingClassName?: string

	/** 
	 * Which style value should be persisted besides cloning for dragging indicator,
	 * like width, height.
	 */
	persistStyleProperties?: (string & keyof CSSStyleDeclaration)[]

	/** Transition duration when playing dragging movement, in milliseconds. */
	transitionDuration?: number

	/** Transition easing when playing dragging movement. */
	transitionEasing?: WebTransitionEasingName

	/** 
	 * Can cause nearest scroller to scroll when touch edges of scroll area.
	 * Default value is `false`.
	 */
	autoScroll?: boolean

	/** 
	 * Generate an element to follow mouse after start dragging.
	 * The returned content may extend `<Popup>` or not, not limit it much.
	 */
	followElementRenderer?: RenderResultRenderer

	/** 
	 * On dragging start.
	 * If prevent default of `e`, will stop dragging action.
	 */
	onStart?: (e: PointerEvent | TouchEvent) => void

	/** 
	 * On dragging end.
	 * If dragging canceled, `drop` is null.
	 */
	onEnd?: (drop: droppable | null) => void
}

const DefaultDraggableOptions: DraggableOptions = {
	name: '',
	autoScroll: false,
}


/** 
 * Base class of `draggable` and `orderable`.
 */
export abstract class DraggableBase<T = any> implements Part {

	abstract readonly mode: string

	readonly el: HTMLElement
	readonly context: any

	/** Draggable options. */
	options: DraggableOptions = DefaultDraggableOptions

	/** Data can be passed to droppable. */
	data: T | null = null

	/** Draggable index between siblings. */
	index: number = -1

	protected connected: boolean = false

	constructor(el: Element, context: any) {
		this.el = el as HTMLElement
		this.context = context
	}

	afterConnectCallback() {
		if (this.connected) {
			return
		}

		if (device.touch) {
			SimulatedEvents.on(this.el, 'hold:start', this.onPointerDownOrHold, this)
		}
		else {
			DOMEvents.on(this.el, 'pointerdown', this.onPointerDownOrHold, this)
		}

		this.el.setAttribute('draggable', 'false')
		this.connected = true

		registerDraggable(this)
	}

	beforeDisconnectCallback(param: PartCallbackParameterMask | 0) {
		if ((param & PartCallbackParameterMask.FromOwnStateChange) === 0) {
			return
		}

		DOMEvents.off(this.el, 'mousedown', this.onPointerDownOrHold, this)

		this.el.removeAttribute('draggable')
		this.connected = false

		unregisterDraggable(this)
	}

	protected onPointerDownOrHold(e: MouseEvent | TouchEvent) {

		// If have `matchSelector` and not match, ignore.
		if (this.options.matchSelector) {
			let target = e.target as Element
			if (!target.closest(this.options.matchSelector)) {
				return
			}
		}

		this.initMover(e)
	}

	protected initMover(e: MouseEvent | TouchEvent) {
		
		// Not persist mover, this object is reuseable.
		let mover = new DragMover(
			false,
			this.onDragStart.bind(this),
			this.onDragEnd.bind(this)
		)

		mover.setDragStart(e)
	}

	protected onDragStart(e: PointerEvent | TouchEvent) {
		this.options.onStart?.call(this.context, e)
		GlobalDragDropRelationship.startDragging(this, e)
	}

	protected onDragEnd() {
		let activeDroppable = GlobalDragDropRelationship.activeDrop
		GlobalDragDropRelationship.endDragging()

		this.options.onEnd?.call(this.context, activeDroppable)
	}

	protected onDataChanged() {
		GlobalDragDropRelationship.tryUpdateDraggingEl(this.el, this.data, this.index)
	}
}


/** 
 * Make current element draggable, and you may move it to a `droppable`.
 * Note you should prevent dragging element margin collapse.
 * 
 * `:draggable=${data, ?options}`
 * - `data`: Data item to identify current dragging item.
 * - `options` Draggable options.
 * 
 * For bound element, you may need to set styles to prevent default selection and hold action:
 * `
 *  user-select: none;
 *	-webkit-user-select: none;
 *	-webkit-touch-callout: none;
 *  touch-action: none;
 * `
 * 
 * or `@include non-select;`.
 */
export class draggable<T = any> extends DraggableBase<T> implements Binding, Part {

	readonly mode: string = 'drag'
	
	update(data: T, options: Partial<DraggableOptions> = {}) {
		let dataChanged = data !== this.data

		this.data = data
		this.options = {...DefaultDraggableOptions, ...options}

		if (dataChanged) {
			this.onDataChanged()
		}
	}
}

