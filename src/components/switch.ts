import {Component, html, css, getCSSEasingValue} from 'lupos.html'
import {DOMEvents, EventKeys} from 'lupos'


interface SwitchEvents {

	/** Triggers after switch on or off state changed. */
	change: (value: boolean) => void
}


/** `<Switch>` allows users to toggle between on and off states. */
export class Switch<E = {}> extends Component<E & SwitchEvents> {

	static override style = css`
		.switch{
			display: inline-block;
			vertical-align: top;
			width: var(--switch-width);
			height: var(--switch-height);
			border: var(--switch-border-width) solid var(--border-color);
			border-radius: calc(var(--switch-height) / 2);
			background: var(--switch-background);
			padding: 1px;
			transition: background 0.2s ${/*#__PURE__*/getCSSEasingValue('ease-out-cubic')};
			cursor: pointer;

			&:hover, &:focus{
				.switch-ball{
					background: color-mix(in srgb, var(--switch-background) 50%, var(--primary-color));
				}
			}
		}
	
		.switch-ball{
			width: calc(var(--switch-height) - 2px - var(--switch-border-width) * 2);
			height: calc(var(--switch-height) - 2px - var(--switch-border-width) * 2);
			background: var(--border-color);
			border-radius: 50%;
			transition: margin 0.2s ${/*#__PURE__*/getCSSEasingValue('ease-out-cubic')};
		}
	
		.switch-on{	
			border-color: var(--primary-color);

			.switch-ball{
				background: var(--primary-color);
				margin-left: calc(var(--switch-width) - var(--switch-height));
			}

			&:hover, &:focus{
				.switch-ball{
					background: var(--primary-color);
				}
			}
		}
	`


	/** Whether the switch is in on state. */
	value: boolean = false

	protected override render() {
		return html`
			<template tabindex="0"
				class="switch"
				:class.switch-on=${this.value}
				@click=${this.onClick}
				@focus=${this.onFocus}
				@blur=${this.onBlur}
			>
				<div class="switch-ball"></div>
			</template>
		`
	}

	protected onClick() {
		this.toggleValue()

		// Should not keep focus when click to toggle.
		this.el.blur()
	}

	protected toggleValue(this: Switch) {
		this.setValue(!this.value)
	}

	protected setValue(this: Switch, value: boolean) {
		if (value !== this.value) {
			this.value = value
			this.fire('change', value)
		}
	}

	protected onFocus() {
		DOMEvents.on(document, 'keydown', this.onKeyDown, this)
	}

	protected onKeyDown(e: KeyboardEvent) {
		let key = EventKeys.getShortcutKey(e)
		if (key === 'Enter') {
			e.stopPropagation()
			this.toggleValue()
		}
		else if (key === 'ArrowLeft') {
			if (this.value) {
				e.preventDefault()
				e.stopPropagation()
				this.setValue(false)
			}
		}
		else if (key === 'ArrowRight') {
			if (!this.value) {
				e.preventDefault()
				e.stopPropagation()
				this.setValue(true)
			}
		}
	}

	protected onBlur() {
		DOMEvents.off(document, 'keydown', this.onKeyDown, this)
	}
}
