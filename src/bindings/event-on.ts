import {Binding, Part, PartCallbackParameterMask} from 'lupos.html'
import {DOMEvents, EventType, InferEventHandler} from 'lupos'


/**
 * To bind dynamic event type.
 * 
 * `:eventOn=${onTouch ? 'touchstart' : 'mousedown', (e) => ...}`
 */
export class eventOn implements Binding, Part {

	protected readonly el: Element
	protected readonly context: any
	protected type: EventType | null = null
	protected handler: ((e: Event) => void) | null = null
	protected boundType: EventType | null = null

	constructor(el: Element, context: any) {
		this.el = el
		this.context = context
	}

	update<T extends EventType>(type: T, handler: InferEventHandler<T> | null) {
		this.type = type
		this.handler = handler as (e: Event) => void
	}

	afterConnectCallback(_param: PartCallbackParameterMask | 0) {
		if (this.boundType && this.boundType !== this.type) {
			DOMEvents.off(this.el, this.boundType, this.handle, this)
			this.boundType = null
		}

		if (this.boundType === null && this.type !== null) {
			DOMEvents.on(this.el, this.type, this.handle, this)
		}
	}

	protected handle(e: Event) {
		this.handler?.call(this.context, e)
	}

	beforeDisconnectCallback(_param: PartCallbackParameterMask | 0) {
		// Do nothing
	}
}
