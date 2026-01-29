import {Binding, Component, Part, render, RenderedComponentLike, RenderResultRenderer} from 'lupos.html'
import {BoxOffsets, DOMUtils, MouseEventDelivery, RectWatcher, StylePropertyName} from 'ff-kit'
import {DOMEvents, EventKeys, UpdateQueue} from 'lupos'
import {Input, Popup, Select} from '../components'


/** 
 * Commit edited value.
 * `value` is null when being canceled.
 * Calls `reshow` if failed to commit and want to re-edit.
 */
export type CommitCallback<T> = (value: T | null, reshow: () => void) => void


export interface EditableOptions<T> {

	/** 
	 * How to trigger the editing:
	 * auto: always trigger.
	 * dblclick: after double click.
	 * Default value is 'dblclick'.
	 */
	trigger?: 'auto' | 'dblclick'

	/** If provided, will firstly query select by this selector to get target element from current. */
	targetSelector?: string

	/** 
	 * Editing value.
	 * Can either be input text, or select value.
	 */
	value?: T | null

	/** Specifies width to cover using width of editing element. */
	width?: number

	/** Specifies height to cover using height of editing element. */
	height?: number

	/** Additional padding values to expand size, and apply to popup element. */
	padding?: number
		| [number]
		| [number, number]
		| [number, number, number]
		| [number, number, number, number]

	/** 
	 * Whether clone style of editing element to input.
	 * Default value is `false`.
	 */
	cloneStyle?: boolean

	/** 
	 * On commit edited value.
	 * Calls `reshow` if failed to commit and want to re-edit.
	 */
	onCommit?: (value: T | null, reshow: () => void) => void

	/** On cancel editing. */
	onCancel?: () => void
}


/** 
 * To render a `<Popup>`, which contains a `<Input>` or `<Select>`,
 * and align it with currently editing element.
 */
export class editable<T> implements Binding, Part {

	readonly el: HTMLElement
	readonly context: any
	protected renderer: RenderResultRenderer | null = null
	protected options: EditableOptions<T> = {}

	protected opened: boolean = false
	protected boundTrigger: 'auto' | 'dblclick' | null = null
	protected target: HTMLElement | null = null
	protected rendered: RenderedComponentLike | null = null
	protected popup: Popup | null = null
	protected inputSelectRef: Input | Select | null = null

	constructor(el: Element, context: any) {
		this.el = el as HTMLElement
		this.context = context
	}

	update(renderer: RenderResultRenderer | null, options: Partial<EditableOptions<T>> = {}) {
		this.renderer = renderer
		this.options = options
		this.updateTriggerBinding()
	}

	afterConnectCallback() {
		if (this.boundTrigger === 'auto' && !this.opened) {
			this.showPopup()
		}
	}

    beforeDisconnectCallback() {
		if (this.opened) {
			this.hidePopup()
		}
	}

	protected updateTriggerBinding() {
		let newTrigger = this.options.trigger ?? 'dblclick'
		if (newTrigger !== this.boundTrigger) {
			if (this.boundTrigger === 'dblclick') {
				DOMEvents.off(this.el, 'dblclick', this.showPopup, this)
			}

			this.boundTrigger = newTrigger

			if (newTrigger === 'dblclick') {
				DOMEvents.on(this.el, 'dblclick', this.showPopup, this)
			}
		}
	}

	async showPopup() {
		if (!this.renderer) {
			return
		}

		if (this.opened) {
			return
		}

		this.opened = true
		let rendered = render(this.renderer, this.context)

		// Connect rendered if not have without appending it to document.
		let connected = await rendered.connectManually()
		if (!connected) {
			return
		}

		if (!this.opened) {
			return
		}

		let target = this.options.targetSelector ? this.el.querySelector(this.options.targetSelector) as HTMLElement : this.el
		if (!target) {
			return
		}

		let popup = rendered.getAs(Popup)
		if (!popup) {
			this.hidePopup()
			return
		}

		this.target = target
		this.popup = popup
		this.rendered = rendered
		this.inputSelectRef = Component.from(popup.el.querySelector('.input, .select')!) as Input | Select
		
		this.updateValue()
		this.updateStyle()
		this.updateSizeAndPosition()

		DOMEvents.on(document, 'mousedown', this.onDOMMouseDown, this)
		DOMEvents.on(document, 'keydown', this.onDOMKeyDown, this)
		MouseEventDelivery.attach(this.target!, popup.el)

		RectWatcher.watch(this.target!, this.updateSizeAndPosition, this)

		// Select all after ready.
		popup.appendTo(document.body)
		this.inputSelectRef.select()

		if (this.inputSelectRef instanceof Select) {
			this.inputSelectRef.opened = true
			this.inputSelectRef.on('change', this.onValueChange, this)
		}
		else {
			this.inputSelectRef.on('change', this.onValueChange, this)
		}
	}

	hidePopup() {
		if (!this.opened) {
			return
		}

		this.opened = false
		this.popup?.remove(true)
		this.rendered?.remove()

		RectWatcher.unwatch(this.target!, this.updateSizeAndPosition, this)

		DOMEvents.off(document, 'mousedown', this.onDOMMouseDown, this)
		DOMEvents.off(document, 'keydown', this.onDOMKeyDown, this)
		MouseEventDelivery.detach(this.target!)

		this.target = null
		this.popup = null
		this.rendered = null
		this.inputSelectRef = null
	}

	protected async updateValue() {
		if (this.options.value) {
			this.inputSelectRef!.value = this.options.value
		}
		else {
			this.inputSelectRef!.value = this.target!.textContent
		}

		await UpdateQueue.untilAllComplete()
		this.inputSelectRef!.select()
	}

	protected updateStyle() {
		if (this.options.cloneStyle) {
			let style = this.getEditingTextStyle()
			DOMUtils.setStyleValues(this.inputSelectRef!.el, style)
		}
	}

	protected getEditingTextStyle(): Partial<Record<StylePropertyName, string>> {
		let style = getComputedStyle(this.target!)

		return {
			'color': style.color,
			'fontFamily': style.fontFamily,
			'fontSize': style.fontSize,
			'fontWeight': style.fontWeight,
			'fontStyle': style.fontStyle,
			'textAlign': style.textAlign,
			'lineHeight': style.lineHeight,
			'padding': style.padding,
		}
	}

	protected updateSizeAndPosition() {
		let rect = this.target!.getBoundingClientRect()
		let style = getComputedStyle(this.target!)
		let textAlignRate = style.textAlign === 'center' ? 0.5 : style.textAlign === 'right' ? 1 : 0
		let elWidth = this.options.width ?? rect.width
		let elHeight = this.options.height ?? rect.height
		let left = rect.left + (rect.width - elWidth) * textAlignRate
		let top = rect.top
		let paddings = this.getPaddings()
		let edges = new BoxOffsets(...paddings)

		let popupStyle = {
			left: left - edges.left + 'px',
			top: top - edges.top + 'px',
			width: elWidth + 'px',
			height: elHeight + 'px',
			padding: paddings.map(p => p + 'px').join(' ')
		}

		DOMUtils.setStyleValues(this.popup!.el, popupStyle)
	}

	protected getPaddings(): number[] {
		if (!this.options.padding) {
			return [0]
		}
		else if (Array.isArray(this.options.padding)) {
			return this.options.padding
		}
		else {
			return [this.options.padding]
		}
	}

	protected onValueChange(value: any) {
		this.options.onCommit?.(value, () => this.reshowPopup(value))
		this.hidePopup()
	}

	protected onDOMMouseDown(e: MouseEvent) {
		let target = e.target as HTMLElement

		if (!MouseEventDelivery.hasDeliveredFrom(this.target!, target)) {
			let value = this.inputSelectRef!.value

			this.options.onCommit?.(value, () => this.reshowPopup(value))
			this.hidePopup()
		}
	}

	protected onDOMKeyDown(e: KeyboardEvent) {
		let key = EventKeys.getShortcutKey(e)
		if (key === 'Escape') {
			e.stopImmediatePropagation()
			this.options.onCancel?.()
			this.hidePopup()
		}
	}

	protected reshowPopup(value: T) {
		this.options.value = value
		this.showPopup()
	}
}