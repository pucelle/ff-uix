import {HVDirection} from 'ff-kit'
import {Binding, Part, PerFrameTransitionEasingName} from 'lupos.html'
import {DOMScroll} from '../tools'


export interface ScrollToOptions {
	where: 'start' | 'view'
	direction?: HVDirection
	gap?: number
	duration?: number
	easing?: PerFrameTransitionEasingName
}


/**
 * `:scrollTo` helps to scroll current element into view
 * or to at the start of scroller after it connected each time.
 */
export class scrollTo implements Binding, Part {

	protected readonly el: HTMLMediaElement
	protected options: ScrollToOptions | null = null

	constructor(el: Element) {
		this.el = el as HTMLMediaElement
	}

	update(options: ScrollToOptions | null = null) {
		this.options = options
	}

	afterConnectCallback() {
		let where = this.options?.where
		if (where === 'start') {
			DOMScroll.scrollToStart(
				this.el,
				this.options?.direction,
				this.options?.gap,
				this.options?.duration,
				this.options?.easing
			)
		}
		else if (where === 'view') {
			DOMScroll.scrollToView(
				this.el,
				this.options?.direction,
				this.options?.gap,
				this.options?.duration,
				this.options?.easing
			)
		}
	}

	beforeDisconnectCallback(): Promise<void> | void {}
}
