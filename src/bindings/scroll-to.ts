import {HVDirection} from 'ff-kit'
import {Binding, Part, PerFrameTransitionEasingName} from 'lupos.html'
import {DOMScroll} from '../tools'


export interface ScrollToOptions {
	direction?: HVDirection
	gap?: number
	duration?: number
	easing?: PerFrameTransitionEasingName
}


/**
 * `:scrollToView` helps to scroll current element
 * into view after it connected each time.
 */
export class scrollToView implements Binding, Part {

	protected readonly el: HTMLMediaElement
	protected options: ScrollToOptions | null = null

	constructor(el: Element) {
		this.el = el as HTMLMediaElement
	}

	update(options: ScrollToOptions | null = null) {
		this.options = options
	}

	afterConnectCallback() {
		DOMScroll.scrollToView(
			this.el,
			this.options?.direction,
			this.options?.gap,
			this.options?.duration,
			this.options?.easing
		)
	}

	beforeDisconnectCallback(): Promise<void> | void {}
}


/**
 * `:scrollToStart` helps to scroll current element to
 * start edge of scroller after it connected each time.
 */
export class scrollToStart implements Binding, Part {

	protected readonly el: HTMLMediaElement
	protected options: ScrollToOptions | null = null

	constructor(el: Element) {
		this.el = el as HTMLMediaElement
	}

	update(options: ScrollToOptions | null = null) {
		this.options = options
	}

	afterConnectCallback() {
		DOMScroll.scrollToStart(
			this.el,
			this.options?.direction,
			this.options?.gap,
			this.options?.duration,
			this.options?.easing
		)
	}

	beforeDisconnectCallback(): Promise<void> | void {}
}
