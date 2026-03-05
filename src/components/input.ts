import {Component, css, html, RenderResult} from 'lupos.html'
import {tooltip, TooltipOptions} from '../bindings'
import {Icon} from './icon'
import {ThemeSize} from '../style'
import {DOMModifiableEvents, UpdateQueue, watch} from 'lupos'
import {IconChecked} from '../icons'
import {sleep} from 'ff-kit'


interface InputEvents {

	/** 
	 * Triggers after input every character.
	 * new `value` as parameter, but note it doesn't apply to Input value property.
	 */
	input: (value: string) => void

	/** 
	 * Triggers after input value changed.
	 * `valid` indicates whether inputted value is valid, only `false` means not valid.
	 * Calls `refocus` can cause input field get focus.
	 */
	change: (value: string, valid: boolean | null, refocus: () => void) => void
}


/** 
 * `<Input>` works just like a `<input type="text">`,
 * you can set validator to validate it's value, or set customized error message.
 */
export class Input<E = {}> extends Component<InputEvents & E> {

	static override style = css`
		.input{
			display: inline-flex;
			align-items: stretch;
			position: relative;
			width: 15em;
			height: 2em;
			padding: 0.2em 0.6em;
			background: var(--input-background);
			box-shadow: inset 0 -1px 0 0 var(--border-color);
			
			&.focused{
				box-shadow: inset 0 -1px 0 0 var(--primary-color);
			}

			&.valid{
				box-shadow: inset 0 -1px 0 0 var(--success-color);
			}

			&.invalid{
				box-shadow: inset 0 -1px 0 0 var(--error-color);
			}
		}

		.input-icon{
			width: 2em;
			height: 100%;
			margin-block: auto;
			margin-left: 8px;
		}

		.input-field{
			flex: 1;
			min-width: 0;
			border: none;
			background: none;

			/** Ensure to inherit <Input> element. */
			color: inherit;
			font-family: inherit;
			font-size: inherit;
			font-weight: inherit;
			font-style: inherit;
			text-align: inherit;
			line-height: inherit;
		}

		.input-valid-icon{
			align-items: center;
			margin-right: 0.2em;
			color: var(--success-color);
		}

		.input-error{
			position: absolute;
			left: 0;
			top: 100%;
			line-height: 2;
			font-size: calc(1em - 1px);
			color: var(--error-color);
		}
	`


	size: ThemeSize = 'default'

	/** Input type, same with `<input type=...>`. */
	type: 'text' | 'password' | 'number' = 'text'

	/** 
	 * Whether get focus after been inserted into document.
	 * Default value is `false`.
	 */
	autoFocus: boolean = false

	/** 
	 * Whether select all text after getting focused.
	 * Default value is `false`.
	 */
	autoSelect: boolean = false

	/** 
	 * Whether input has been touched, error messages only appears after touched.
	 * Set it from `false` to `true` will cause validate immediately.
	 */
	touched: boolean = false

	/** Whether current input is valid, be `null` if not validate yet. */
	valid: boolean | null = null

	/** Placeholder shows when input content is empty. */
	placeholder: string = ''
	
	/** Current value. */
	value: string = ''

	/** 
	 * To validate current value, returns error message or `null` if valid.
	 * Can also returns `null` and later set `error` asynchronously.
	 */
	validator: ((value: string) => string | null) | null = null

	/** Format whole input value, like trimming. */
	formatter: ((value: string) => string) | null = null

	/** Show custom error message. */
	errorMessage: string | null = ''

	/** 
	 * Whether show error on a tooltip, so it doesn't need to leave a space for error message.
	 * Default value is `false`.
	 */
	errorOnTooltip: boolean = false

	/** 
	 * Whether update value after change event.
	 * If is `false`, update value and trigger change event after every time input.
	 * Note set `lazy` to `false` also cause validator valid early.
	 */
	lazy: boolean = true

	/** Specifies the icon shown on the left. */
	icon: string | null = null

	/** Whether haven got focus already. */
	protected focusGot: boolean = false

	/** Input field element reference. */
	protected fieldRef!: HTMLInputElement | HTMLTextAreaElement

	protected override async onConnected() {
		super.onConnected()
		
		// `autofocus` property work for only for the first time.
		if (this.autoFocus) {
			await UpdateQueue.untilAllComplete()

			// If within a popup, it may be postpone for several microtask ticks.
			await sleep(0)
			this.fieldRef.focus()
		}
	}

	protected override onWillDisconnect() {
		super.onWillDisconnect()
		DOMModifiableEvents.off(document, 'keydown', this.onEnter, this)
	}
	
	protected override render() {
		return html`
			<template class="input size-${this.size}"
				:class.focused=${this.focusGot}
				:class.valid=${this.touched && this.valid}
				:class.invalid=${this.touched && this.valid === false}
				?:tooltip=${
					this.touched && this.errorMessage && this.errorOnTooltip,
					this.errorMessage,
					{type: 'error'} as Partial<TooltipOptions>
				}
			>
				${this.renderIcon()}
				${this.renderField()}

				<lu:if ${this.touched && this.valid}>
					<Icon class="input-valid-icon" .icon=${IconChecked} />
				</lu:if>

				<lu:if ${this.touched && this.errorMessage && !this.errorOnTooltip}>
					<div class="input-error">${this.errorMessage}</div>
				</lu:if>
			</template>
		`
	}

	/** Can overwrite to render an icon. */
	protected renderIcon(): RenderResult {
		if (!this.icon) {
			return null
		}

		return html`
			<Icon class="input-icon" 
				.icon=${this.icon}
			/>
		`
	}

	protected renderField() {
		return html`
			<input class="input-field" type=${this.type}
				?autofocus=${this.autoFocus}
				.placeholder=${this.placeholder || ''}
				.value=${this.value}
				:ref=${this.fieldRef}
				@focus=${this.onFocus}
				@blur=${this.onBlur}
				@input=${this.onInput}
				@change=${this.onChange}
			/>
		`
	}

	protected onFocus() {
		this.focusGot = true

		if (this.autoSelect) {
			this.select()
		}

		DOMModifiableEvents.on(document, 'keydown', ['Enter'], this.onEnter, this)
	}

	protected onEnter(e: Event) {
		e.stopPropagation()
		this.onChange()
	}

	protected onBlur() {
		DOMModifiableEvents.off(document, 'keydown', this.onEnter, this)
		
		this.focusGot = false
		this.touched = true

		// Validate after only change event is not enough.
		// Since we clear error message after input,
		// So may still not valid even though not changed.
		this.validate()
	}

	protected onInput(this: Input, e: KeyboardEvent) {
		if (e.isComposing) {
			return
		}

		let value = this.fieldRef.value
		if (this.formatter) {
			value = this.formatter(value)
		}

		// Clear validate result after input.
		if (this.lazy) {
			if (this.validator) {
				this.valid = null
				this.errorMessage = ''
			}
		}
		else {
			this.value = value
			this.validate()
		}

		this.fire('input', value)

		if (!this.lazy) {
			this.fire('change', value, this.valid, () => this.fieldRef.focus())
		}
	}

	protected onChange(this: Input) {

		// Remove element also cause change event fired.
		if (!this.connected) {
			return
		}

		let value = this.fieldRef.value
		if (this.formatter) {
			value = this.formatter(value)
		}

		this.value = value
		this.validate()
		this.fire('change', value, this.valid, () => this.fieldRef.focus())
	}

	@watch('touched')
	protected onSetTouched(touched: boolean) {
		if (touched) {
			this.validate()
		}
	}

	protected validate() {
		if (this.validator) {
			let value = this.value
			let error = this.validator(this.value)

			if (value === this.value) {
				this.errorMessage = error
				this.valid = !error
			}
		}
	}

	/** Focus on input field. */
	focus() {
		this.fieldRef.focus()
	}

	/** Select all text. */
	select() {
		this.fieldRef.select()
	}
}