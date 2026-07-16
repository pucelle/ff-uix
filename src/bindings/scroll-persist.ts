import {ScrollUtils} from 'ff-kit'
import {UpdateQueue} from 'lupos'
import {Binding, Part} from 'lupos.html'


export interface ScrollPersistOptions {
	key?: string
	direction?: 'horizontal' | 'vertical' | 'none' | null
	reTarget?: string
}


/**
 * `:scrollPersist` helps to persist scroll position of bound element
 * after it disconnected, and restore it after gets re-connected.
 * 
 * It can also be used reset scroll position after key changed.
 * 
 * If `options.key` is specified, positions will save and restore by this key.
 * If `options.direction` is specified, will try detect itself.
 * If `options.reTarget` is specified, use it as parental scroller selector.
 */
export class scrollPersist implements Binding, Part {

	protected readonly el: HTMLMediaElement
	protected options: ScrollPersistOptions | null = null
	protected positionMap: Map<string, number> = new Map()
	protected key: string = ''
	protected direction: 'horizontal' | 'vertical' | 'none' | null = null
	protected scroller: HTMLElement | null = null

	constructor(el: Element) {
		this.el = el as HTMLMediaElement
	}

	async update(options: ScrollPersistOptions = {}) {
		this.options = options

		if (options.direction) {
			this.direction = options.direction
		}

		let newKey = options.key ?? ''
		if (newKey !== this.key) {
			this.key = newKey
			this.savePosition()

			// Restore scroll position for new key after key changed.
			await UpdateQueue.untilComplete()
			this.restorePosition()
		}
	}

	afterConnectCallback() {
		if (!this.scroller) {
			if (this.options?.reTarget) {
				this.scroller = this.el.closest(this.options.reTarget)
			}
			else {
				this.scroller = this.el
			}
		}

		if (this.direction === null && this.scroller) {
			UpdateQueue.untilComplete().then(this.readScrollInfo.bind(this))
		}
		else if (this.positionMap.has(this.key)) {
			this.restorePosition()
		}
	}

	protected readScrollInfo() {
		this.direction = ScrollUtils.getCSSOverflowDirection(this.el) ?? 'none'

		if (this.positionMap.has(this.key)) {
			this.restorePosition()
		}
	}

	protected restorePosition() {
		if (!this.scroller) {
			return
		}

		if (this.direction === 'horizontal') {
			this.scroller.scrollLeft = this.positionMap.get(this.key) ?? 0
		}
		else if (this.direction === 'vertical') {
			this.scroller.scrollTop = this.positionMap.get(this.key) ?? 0
		}
	}

	protected savePosition() {
		if (!this.scroller) {
			return
		}

		if (this.direction === 'horizontal') {
			this.positionMap.set(this.key, this.scroller.scrollLeft)
		}
		else if (this.direction === 'vertical') {
			this.positionMap.set(this.key, this.scroller.scrollTop)
		}
	}

	beforeDisconnectCallback(): Promise<void> | void {
		this.savePosition()
	}
}
