import {ResizeWatcher, SizeLike} from 'ff-kit'
import {Binding, Part, PartCallbackParameterMask} from 'lupos.html'


/**
 * To read and watch the size of current element.
 * 
 * `:watchSize=${(newSize, el) => ...}`
 */
export class watchSize implements Binding, Part {

	protected readonly el: Element
	protected readonly context: any
	protected size: SizeLike | null = null
	protected sizeFn: ((size: SizeLike, el: Element) => void) | null = null

	constructor(el: Element, context: any) {
		this.el = el
		this.context = context
	}

	update(sizeFn: (size: SizeLike, el: Element) => void) {
		this.sizeFn = sizeFn
	}

	afterConnectCallback(_param: PartCallbackParameterMask | 0) {
		ResizeWatcher.watch(this.el, this.onSizeChange, this)
	}

	protected onSizeChange(entry: ResizeObserverEntry) {
		let newSize = {width: entry.contentRect.width, height: entry.contentRect.height}

		if (!this.size || this.size.width !== newSize.width || this.size.height !== newSize.height) {
			this.size = newSize
			this.sizeFn?.call(this.context, newSize, this.el)
		}
	}

	beforeDisconnectCallback(_param: PartCallbackParameterMask | 0) {
		ResizeWatcher.unwatch(this.el, this.onSizeChange, this)
	}
}


/**
 * To read and watch the width of current element.
 * 
 * `:watchWidth=${(newWidth, el) => ...}`
 */
export class watchWidth implements Binding, Part {

	protected readonly el: Element
	protected readonly context: any
	protected width: number | null = null
	protected sizeFn: ((width: number, el: Element) => void) | null = null

	constructor(el: Element, context: any) {
		this.el = el
		this.context = context
	}

	update(widthFn: (width: number, el: Element) => void) {
		this.sizeFn = widthFn
	}

	afterConnectCallback(_param: PartCallbackParameterMask | 0) {
		ResizeWatcher.watch(this.el, this.onSizeChange, this)
	}

	protected onSizeChange(entry: ResizeObserverEntry) {
		let newWidth = entry.contentRect.width

		if (!this.width || this.width !== newWidth) {
			this.width = newWidth
			this.sizeFn?.call(this.context, newWidth, this.el)
		}
	}

	beforeDisconnectCallback(_param: PartCallbackParameterMask | 0) {
		ResizeWatcher.unwatch(this.el, this.onSizeChange, this)
	}
}



/**
 * To read and watch the height of current element.
 * 
 * `:watchHeight=${(newHeight, el) => ...}`
 */
export class watchHeight implements Binding, Part {

	protected readonly el: Element
	protected readonly context: any
	protected height: number | null = null
	protected sizeFn: ((height: number, el: Element) => void) | null = null

	constructor(el: Element, context: any) {
		this.el = el
		this.context = context
	}

	update(heightFn: (height: number, el: Element) => void) {
		this.sizeFn = heightFn
	}

	afterConnectCallback(_param: PartCallbackParameterMask | 0) {
		ResizeWatcher.watch(this.el, this.onSizeChange, this)
	}

	protected onSizeChange(entry: ResizeObserverEntry) {
		let newHeight = entry.contentRect.height

		if (!this.height || this.height !== newHeight) {
			this.height = newHeight
			this.sizeFn?.call(this.context, newHeight, this.el)
		}
	}

	beforeDisconnectCallback(_param: PartCallbackParameterMask | 0) {
		ResizeWatcher.unwatch(this.el, this.onSizeChange, this)
	}
}