import {ResizeWatcher, SizeLike} from 'ff-kit'
import {Binding, Part, PartCallbackParameterMask} from 'lupos.html'


/**
 * To read size of current element, and evert time after size changed.
 * 
 * `:readSize=${(newSize, el) => ...}`
 */
export class readSize implements Binding, Part {

	protected readonly el: Element
	protected readonly context: any

	/** Compiler will compile `this.prop` -> `r => this.prop = r` */
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
		this.sizeFn?.call(this.context, entry.contentRect, this.el)
	}

	beforeDisconnectCallback(_param: PartCallbackParameterMask | 0) {
		ResizeWatcher.unwatch(this.el, this.onSizeChange, this)
	}
}
