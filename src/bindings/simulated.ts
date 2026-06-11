import {SimulatedEvents} from 'ff-kit'
import {Binding, Part, PartCallbackParameterMask} from 'lupos.html'


/**
 * To bind simulated events, include
 * - `tap`
 * - `double-tap`
 * - `hold`
 * - `pinch-transform`
 * - `pinch-zoom`
 * - `slide`
 * 
 * `:simulated.tap=${e => ...}`
 * `:simulated.hold:start=${e => ...}`
 */
export class simulated implements Binding, Part {

	protected readonly el: Element
	protected readonly context: any
	protected type: SimulatedEvents.EventType
	protected handler: ((...args: any[]) => void) | null = null

	constructor(el: Element, context: any, modifiers: [SimulatedEvents.EventType]) {
		this.el = el
		this.context = context
		this.type = modifiers[0]
	}

	update(handler: ((...args: any[]) => void) | null) {
		this.handler = handler
	}

	afterConnectCallback(_param: PartCallbackParameterMask | 0) {
		SimulatedEvents.on(this.el, this.type, this.handle, this)
	}

	protected handle(...args: any[]) {
		this.handler?.call(this.context, ...args)
	}

	beforeDisconnectCallback(_param: PartCallbackParameterMask | 0) {
		SimulatedEvents.off(this.el, this.type, this.handle, this)
	}
}
