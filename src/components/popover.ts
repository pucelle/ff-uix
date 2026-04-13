import {css, html, fade, RenderResultRenderer, RenderResult} from 'lupos.html'
import {Popup} from './popup'
import {Triangle} from './triangle'
import {Icon} from './icon'
import {IconClose} from '../icons'
import {Button} from './button'
import {tooltip} from '../bindings'


export interface PopoverAction {

	/** Button text. */
	text: string

	/** Tooltip text or result. */
	tooltip?: RenderResultRenderer

	/** Action button becomes primary if set to `true`. */
	primary?: boolean

	/** 
	 * Calls after clicked the action button.
	 * You may return `true` to interrupt model from closing,
	 * and return `null` or void to continue closing.
	 */
	handler?: () => Promise<boolean | null | void> | boolean | null | void
}


/** 
 * `<Popover>` displays content message on a popup besides it's trigger element.
 */
export class Popover<E = {}> extends Popup<E> {

	static override style = css`
		.popover{
			padding: 0.6em 1em;
			min-width: 15em;
			max-width: 30em;
		}

		.popover-triangle{
			left: 1em;
		}

		.popover-header{
			display: flex;
			font-size: calc(1em - 1px);
			padding-bottom: 0.3em;
			border-bottom: 1px solid color-mix(in srgb, var(--text-color) 80%, var(--background));
			margin-bottom: 0.5em;
		}

		.popover-title{
			flex: 1;
			min-width: 0;
			font-weight: bold;
			overflow: hidden;
			white-space: nowrap;
			text-overflow: ellipsis;
		}

		.popover-close{
			display: flex;
			width: 2em;
			height: 2em;
			margin-top: -0.2em;
			margin-right: -0.6em;
			cursor: pointer;

			&:active{
				transform: translateY(1px);
			}

			.icon{
				margin: auto;
			}
		}

		.popover-actions{
			margin-left: 2em;
		}
		
		.popover-action{
			margin-left: 0.4em;
			line-height: 1.5em;
			padding: 0 0.6em;
		}

		.popover-content{
			line-height: 1.5em;
			padding: 0.2em 0;
		}
	`


	/** Popover title. */
	title: string = ''

	/** Whether displays a close icon to quickly close current popover. */
	closable: boolean = false

	/** Popover actions. */
	actions: PopoverAction[] | null = null

	protected override render() {
		return html`
			<template class="popup popover"
				:transition.immediate=${fade()}
			>
				<lu:if ${this.triangle}>
					<Triangle class="popover-triangle" .direction=${this.triangleDirection} />
				</lu:if>
				${this.renderHead()}
				<div class="popover-content"><slot /></div>
			</template>
		`
	}

	protected renderHead() {
		let haveAction = this.actions && this.actions.length > 0

		if (!this.title && !haveAction) {
			return null
		}

		return html`
			<div class="popover-header">
				<lu:if ${this.title}>
					<div class="popover-title">${this.title}</div>
				</lu:if>

				${this.renderActions()}

				<lu:if ${this.closable && !haveAction}>
					<div class="popover-close" @click=${this.close}>
						<Icon .code=${IconClose} />
					</div>
				</lu:if>
			</div>
		`
	}

	/** Render action buttons, can be overwritten. */
	protected renderActions(): RenderResult {
		let haveAction = this.actions && this.actions.length > 0
		if (!haveAction) {
			return null
		}

		return html`<div class="popover-actions">${this.actions!.map(action => html`
			<Button class="popover-action"
				.primary=${!!action.primary}
				:tooltip=${action.tooltip ?? null, {position: 'b'}}
				@click=${() => this.onClickActionButton(action)}
			>
				${action.text}
			</Button>
		`)}</div>`
	}

	protected async onClickActionButton(action: PopoverAction) {

		// Prevent from closing.
		if (action.handler) {
			let returned = action.handler()

			if (returned instanceof Promise) {
				returned = await returned
			}

			if (returned === true) {
				return
			}
		}

		this.close()
	}
}
