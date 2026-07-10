import {css, html, Component, RenderResult, fade, RenderResultRenderer} from 'lupos.html'
import {AnchorAligner} from 'ff-kit'
import {DOMModifiableEvents, UpdateQueue} from 'lupos'
import {Icon} from './icon'
import {IconClose} from '../icons'
import {Button} from './button'
import {tooltip} from '../bindings/tooltip'


export interface ModelAction {

	/** Button text. */
	text: string

	/** Tooltip text or result. */
	tooltip?: RenderResultRenderer

	/** Action button becomes primary if set to `true`. */
	primary?: boolean

	/** Third action button of will be put on the left. */
	third?: boolean

	/** 
	 * Calls after clicked the action button.
	 * You may return `true` to interrupt model from closing,
	 * and return `null` or `void` to continue closing.
	 */
	handler?: () => Promise<boolean | null | void> | boolean | null | void
}


export interface ModelEvents {

	/** On user manually close the modal. */
	close: () => void
}


/** 
 * `<Modal>` displays blocking-level content and help to
 * complete a child task on a popup modal.
 */
export class Modal<E = {}> extends Component<E & ModelEvents> {

	static override style = css`
		.modal{
			position: fixed;
			display: flex;
			flex-direction: column;
			z-index: 1000;	/* Same with popup. */
			border-radius: var(--popup-border-radius);
			box-shadow: 0 0 var(--popup-shadow-blur-radius) var(--popup-shadow-color);
			background: var(--background);
			border: var(--popup-border-width) solid var(--popup-border-color);
			max-width: calc(100dvw - 20px);
			max-height: calc(100dvh - 20px);
			overflow: hidden;
			--background: var(--popup-background);
		}

		.modal-mask{
			position: fixed;
			z-index: 1000;
			left: 0;
			top: 0;
			width: 100%;
			height: 100%;
			background: rgba(0, 0, 0, 0.5);
		}

		.modal-header{
			display: flex;
			flex-direction: row;
			align-items: center;
			flex: none;
			font-size: calc(1em - 1px);
			padding: 0 1.2em;
			border-bottom: 1px solid color-mix(in srgb, var(--text-color) 80%, var(--background));
		}

		.modal-title{
			flex: 1;
			min-width: 0;
			line-height: 2.8;
			overflow: hidden;
			white-space: nowrap;
			text-overflow: ellipsis;
		}

		.modal-close{
			display: flex;
			align-self: stretch;
			margin-top: 0;
			margin-right: -1.2em;
			width: 3em;
			cursor: pointer;

			&:hover{
				color: var(--primary-color);
			}

			&:active{
				transform: translateY(1px);
			}
		}

		.modal-actions{
			margin-left: 1.2em;
			display: flex;
			flex-direction: row;
			align-items: center;
		}

		.modal-action{
			margin-left: 0.6em;
			font-size: calc(1em - 1px);
		}

		.modal-third{
			margin-left: 0;
			margin-right: auto;
		}

		.modal-content{
			flex: 1;
			min-height: 0;
			display: flex;
			flex-direction: column;
			overflow-y: auto;
			padding: 0.6em 1.2em;
		}
	`

	/** To contain both modal and mask. */
	declare static tagName: 'slot'

	
	/** Modal title. */
	title: string = ''

	/** 
	 * Whether modal opened.
	 * Can specified as `true` to auto-show modal after it created.
	 */
	opened: boolean = false

	/** 
	 * If `true`, will quickly hide current modal after clicking
	 * modal mask or pressing `Escape` key.
	 */
	quickHidden: boolean = false

	/** Model actions. */
	actions: ModelAction[] | null = null

	protected modalEl!: HTMLElement

	constructor(el: HTMLElement = document.createElement('slot')) {
		super(el)
	}

	protected override render() {
		return html`
			<template>
				${this.renderMask()}
				${this.renderModal()}
			</template>
		`
	}

	protected renderMask() {

		// Click to stop because we don't want some click-to-pop
		// tips get closed after clicking the mask.

		return html`
			<div class="modal-mask"
				:transition.global=${fade()}
				@click.stop=${this.onClickMask}
				@mousedown.stop=${() => {}}
			/>
		`
	}

	protected renderModal() {
		return html`
			<div tabindex="0" autofocus
				class="modal"
				:ref=${this.modalEl}
				:transition=${fade()}
			>
				${this.renderHeader()}
				${this.renderContent()}
			</div>
		`
	}

	protected renderHeader() {
		return html`
			<div class="modal-header">
				<div class="modal-title">${this.title}</div>

				<lu:if ${this.actions && this.actions.length > 0}>
					${this.renderActions()}
				</lu:if>
				<lu:else>
					<Icon class="modal-close"
						.code=${IconClose}
						@click=${this.hide}
						@mousedown.stop=${() => {}}
					/>
				</lu:else>
			</div>
		`
	}

	/** Render action buttons, can be overwritten. */
	protected renderActions(): RenderResult {
		return html`
			<div class="modal-actions">
			${
				this.actions!.map(action => html`
					<Button class="modal-action"
						.primary=${!!action.primary}
						:class.modal-third=${action.third}
						:tooltip=${action.tooltip ?? null, {position: 'b'}}
						@click=${() => this.onClickActionButton(action)}
					>
						${action.text}
					</Button>
				`)
			}
			</div>
		`
	}

	protected onClickMask() {
		if (this.quickHidden) {
			this.hide()
		}
	}

	protected async onClickActionButton(action: ModelAction) {

		// Prevent from closing.
		if (action.handler) {
			let returned = action.handler.call(this)

			if (returned instanceof Promise) {
				returned = await returned
			}

			if (returned === true) {
				return
			}
		}

		this.hide()
	}

	/** Can be overwritten. */
	protected renderContent(): RenderResult {
		return html`
			<div class="modal-content">
				<slot />
			</div>
		`
	}

	protected override onReady() {
		super.onReady()

		if (this.opened) {
			this.doShow()
		}
	}

	protected override async onConnected() {
		super.onConnected()

		// Make it becomes open it if rendered.
		if (!this.opened) {
			this.opened = true
			this.doShow()
		}

		if (this.quickHidden) {
			DOMModifiableEvents.on(document, 'keydown', ['Escape'], this.hide, this)
		}

		await UpdateQueue.untilComplete()
		this.toCenter()
	}

	protected override onWillDisconnect() {
		if (this.opened) {
			this.opened = false
			this.doHide()
		}

		if (this.quickHidden) {
			DOMModifiableEvents.off(document, 'keydown', this.hide, this)
		}
	}

	protected toCenter() {
		new AnchorAligner(this.modalEl, {position: 'c'}).alignTo(document.documentElement)
	}

	/**
	 * To show the modal immediately.
	 * You may also instantiate and append to `body` if you want
	 * to render `<Modal>` as a child content.
	 */ 
	show() {
		if (this.opened) {
			return
		}

		this.opened = true
		this.doShow()
	}

	protected doShow() {
		this.appendTo(document.body)
	}

	hide(this: Modal) {
		if (!this.opened) {
			return
		}

		this.opened = false
		this.doHide()
		this.fire('close')
	}

	/** Do hide action. */
	protected doHide() {
		this.remove(true)
	}
}