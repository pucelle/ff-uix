import {DOMEvents} from 'lupos'
import {Binding, Part} from 'lupos.html'


/** 
 * Apply an accessible role and keyboard activation to custom action elements.
 * For a button or a link role, will also bind key event to fast active.
 */
export class role implements Binding, Part {

	/** Bound element. */
	protected readonly el: HTMLElement

	/** Whether the binding added a tab stop. */
	protected addedTabIndex: boolean = false

	/** Current role after updated. */
	protected role: string | null | undefined

	constructor(el: Element) {
		this.el = el as HTMLElement
	}

	/** Apply the role and maintain a tab stop for custom actions. */
	update(role: string | null | undefined) {
		if (role) {
			this.el.setAttribute('role', role)
		}
		else {
			this.el.removeAttribute('role')
		}

		let actionable = role === 'button' || role === 'link'
		let native = this.el.matches('button, a[href], input, select, textarea')

		if (actionable && !native && !this.el.hasAttribute('tabindex')) {
			this.el.setAttribute('tabindex', '0')
			this.addedTabIndex = true
		}
		else if ((!actionable || native) && this.addedTabIndex) {
			if (this.el.getAttribute('tabindex') === '0') {
				this.el.removeAttribute('tabindex')
			}

			this.addedTabIndex = false
		}

		this.role = role
	}

	/** Listen for keyboard activation while connected. */
	afterConnectCallback() {
		DOMEvents.on(this.el, 'keydown', this.activateAccessibleAction, this)
	}

	/** Remove the keyboard listener when disconnected. */
	beforeDisconnectCallback() {
		DOMEvents.off(this.el, 'keydown', this.activateAccessibleAction, this)
	}

	/** Give custom button/link elements keyboard activation without intercepting nested controls or native elements. */
	protected activateAccessibleAction(event: KeyboardEvent) {
		let element = this.el
		let role = this.role
		let actionable = role === 'button' || role === 'link'

		if (!actionable) {
			return
		}

		let activationKey = event.key === 'Enter' || role === 'button' && event.key === ' '
		if (actionable
			&& activationKey
			&& !event.repeat
			&& !event.defaultPrevented
			&& event.target === element
			&& element.getAttribute('aria-disabled') !== 'true'
		) {
			event.preventDefault()
			element.click()
		}
	}
}
