import {html, IN_SSR, RenderResultRenderer} from 'lupos.html'
import {Timeout} from 'ff-kit'
import {popup, PopupOptions} from './popup'
import {TooltipType, Tooltip} from '../components/tooltip'
import {device} from '../tools/device'



export interface TooltipOptions extends PopupOptions{

	/** Tooltip type, `default | prompt | error`. */
	readonly type: TooltipType

	/** Class name which will be assigned to `<Tooltip>` element. */
	className?: string

	/** Tooltip triangle width, default equals to <Tooltip> default triangle width. */
	triangleWidth: number

	/** Tooltip triangle width, default equals to <Tooltip> default triangle height. */
	triangleHeight: number

	/**
	 * Auto hide after this many milliseconds of being displayed, even when kept visible.
	 * `null` disables auto hiding; `0` hides on the next timer tick.
	 * Defaults to 3000ms for mouse-less devices, otherwise `null`.
	 */
	autoHideDelay: number | null
}


const DEFAULT_TOOLTIP_OPTIONS: Partial<TooltipOptions> = {

	key: 'tooltip',

	position: 'r',
	gaps: 1,

	/** Make it can be shown even out-of viewport. */
	stickToEdges: true,

	showDelay: 0,
	hideDelay: 200,
	autoHideDelay: device.mouse ? null : 3000,

	type: 'default',

	triangleWidth: Tooltip.triangleWidth,
	triangleHeight: Tooltip.triangleHeight,
}


/**
 * A `:tooltip` binding can help to show a short text message besides bound element.
 * 
 * `:tooltip="message"`
 * `:tooltip=${message}`
 * `:tooltip=${message, {position, ...}}`
 * `:tooltip=${() => message, {position, ...}}`
 */
export class tooltip extends popup {

	/** For overwriting default tooltip options. */
	static override Default: Partial<TooltipOptions> = DEFAULT_TOOLTIP_OPTIONS


	declare options: TooltipOptions

	/** Timeout for dismissing the displayed tooltip. */
	protected autoHideTimeout: Timeout | null = null

	override update(renderer: string | RenderResultRenderer | null, options: Partial<TooltipOptions> = {}) {
		let oldAutoHideDelay = this.options.autoHideDelay

		options = {...DEFAULT_TOOLTIP_OPTIONS, ...options}
		super.update(renderer ? this.popupRenderer.bind(this, renderer) : null, options)

		if (oldAutoHideDelay !== this.options.autoHideDelay) {
			this.updateAutoHideTimeout()
		}
	}

	/** Start the countdown only after the tooltip is displayed. */
	protected override async doShow() {
		await super.doShow()
		this.updateAutoHideTimeout()
	}

	/** Cancel the countdown before hiding or releasing a shared tooltip. */
	protected override async doHide(immediately: boolean) {
		this.updateAutoHideTimeout()
		await super.doHide(immediately)
	}

	/** Replace the countdown when the delay changes, or cancel it when disabled. */
	protected updateAutoHideTimeout() {
		this.autoHideTimeout?.cancel()
		this.autoHideTimeout = null

		if (IN_SSR || !this.opened || !this.renderer) {
			return
		}

		let delay = this.options.autoHideDelay
		if (delay !== null && delay !== undefined) {
			this.autoHideTimeout = new Timeout(() => this.hidePopup(), delay)
			this.autoHideTimeout.start()
		}
	}

	protected popupRenderer(renderer: string | RenderResultRenderer) {
		let rendered = typeof renderer === 'function' ? renderer.call(this.context) : renderer

		return html`
			<Tooltip
				:class=${this.options.className ?? ''}
				.type=${this.options.type}
				.triangleWidth=${this.options.triangleWidth}
				.triangleHeight=${this.options.triangleHeight}
			>
				${rendered}
			</Tooltip>
		`
	}

	protected override shouldShowImmediately(): boolean {
		if (IN_SSR) {
			return false
		}

		if (!this.renderer) {
			return false
		}

		return this.options.showImmediately
			|| this.options.type === 'prompt'
			|| this.options.type === 'error'
	}

	protected override shouldKeepVisible(): boolean {
		if (IN_SSR) {
			return false
		}
		
		if (!this.renderer) {
			return false
		}
		
		return this.options.keepVisible
			|| this.options.type === 'prompt'
			|| this.options.type === 'error'
	}
}
