import {DOMEvents, Observed} from 'lupos'


export class Device implements Observed {

	/** When under pad size. */
	pad = typeof window !== 'undefined' ? window.innerWidth <= 1024 : false

	/** When under phone size. */
	phone = typeof window !== 'undefined' ? window.innerWidth <= 768 : false

	/** Current device width. */
	width = typeof window !== 'undefined' ? window.innerWidth : 1920

	/** Whether use finger mainly to touch. */
	readonly touch: boolean

	/** Whether use mouse mainly to operate. */
	readonly mouse: boolean

	constructor() {
		if (typeof window !== 'undefined') {
			DOMEvents.on(window, 'resize', () => {
				this.pad = window.innerWidth <= 1024
				this.phone = window.innerWidth <= 768
				this.width = window.innerWidth
			})
		}

		this.mouse = matchMedia('(hover: hover)').matches
		this.touch = !this.mouse
	}
}


/** To dynamically compute device width, and query for mouse or touch. */
export const device = new Device()
