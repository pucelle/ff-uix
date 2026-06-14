import {Binding, Part, PartCallbackParameterMask} from 'lupos.html'
import {DOMEvents, EventType, InferEventHandler} from 'lupos'
import {SimulatedEvents} from 'ff-kit'


/** Both dom event and simulated events. */
export type EventTypeMixed = EventType | SimulatedEvents.EventType

/** Both dom event and simulated handlers. */
export type EventHandlerMixed = InferEventHandler<any> | SimulatedEvents.Events[SimulatedEvents.EventType]

/** Both dom event and simulated event options. */
export type EventOptionsMixed = AddEventListenerOptions| SimulatedEvents.Options


/**
 * To bind dynamic event type, can be used to bind simulated events.
 * 
 * `:eventOn=${onTouch ? 'touchstart' : 'mousedown', (e) => ...}`
 * `:eventOn=${onTouch ? 'hold' : 'click', (e) => ...}`
 */
export class eventOn implements Binding, Part {

	protected readonly el: Element
	protected readonly context: any
	protected type: EventTypeMixed | null = null
	protected handler: EventHandlerMixed | null = null
	protected options: EventOptionsMixed | undefined = undefined
	protected boundType: EventType | null = null

	constructor(el: Element, context: any) {
		this.el = el
		this.context = context
	}

	update<T extends EventTypeMixed>(type: T, handler: EventHandlerMixed | null, options?: EventOptionsMixed) {
		this.type = type
		this.handler = handler
		this.options = options
	}

	afterConnectCallback(_param: PartCallbackParameterMask | 0) {
		if (this.boundType && this.boundType !== this.type) {

			if (SimulatedEvents.hasType(this.boundType)) {
				SimulatedEvents.off(this.el, this.boundType as SimulatedEvents.EventType, this.handle as any, this)
			}
			else {
				DOMEvents.off(this.el, this.boundType, this.handle, this)
			}

			this.boundType = null
		}

		if (this.boundType === null && this.type !== null) {
			if (SimulatedEvents.hasType(this.type)) {
				SimulatedEvents.on(this.el, this.type, this.handle as any, this, this.options as SimulatedEvents.Options)
			}
			else {
				DOMEvents.on(this.el, this.type, this.handle, this, this.options as AddEventListenerOptions)
			}
		}
	}

	protected handle(...args: any[]) {
		(this.handler as any)?.call(this.context, ...args)
	}

	beforeDisconnectCallback(_param: PartCallbackParameterMask | 0) {
		// Do nothing
	}
}
