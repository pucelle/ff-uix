import {DOMEvents, Observed} from 'lupos'
import {onPageInit} from 'lupos.html'


export class Device implements Observed {

	/** When under pad size. */
	pad = typeof window !== 'undefined' ? window.innerWidth <= 1024 : false

	/** When under phone size. */
	phone = typeof window !== 'undefined' ? window.innerWidth <= 768 : false

	/** Current device width. */
	width = window.innerWidth

	/** Whether in touch-only mode. */
	readonly touch: boolean

	/** Whether have mouse. */
	readonly mouse: boolean

	constructor() {
		DOMEvents.on(window, 'resize', () => {
			this.pad = window.innerWidth <= 1024
			this.phone = window.innerWidth <= 768
			this.width = window.innerWidth
		})

		this.mouse = matchMedia('(hover: hover)').matches
		this.touch = !this.mouse
	}
}


/** To dynamically compute device width, and query for mouse or touch. */
export let device!: Device

/** Avoid initialize it immediately on SSR env. */
/*#__PURE__*/onPageInit(() => {
	device = device ?? new Device()
})

