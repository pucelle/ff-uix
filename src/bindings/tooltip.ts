import {html, inSSR, RenderResultRenderer} from 'lupos.html'
import {popup, PopupOptions} from './popup'
import {TooltipType, Tooltip} from '../components/tooltip'



export interface TooltipOptions extends PopupOptions{

	/** Tooltip type, `default | prompt | error`. */
	readonly type: TooltipType

	/** Class name which will be assigned to `<Tooltip>` element. */
	className?: string

	/** Tooltip triangle width, default equals to <Tooltip> default triangle width. */
	triangleWidth: number

	/** Tooltip triangle width, default equals to <Tooltip> default triangle height. */
	triangleHeight: number
}


const DefaultTooltipOptions: Partial<TooltipOptions> = {

	key: 'tooltip',

	position: 'r',
	gaps: 1,

	/** Make it can be shown even out-of viewport. */
	stickToEdges: true,

	showDelay: 0,
	hideDelay: 200,

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
	static override Default: Partial<TooltipOptions> = DefaultTooltipOptions 


	declare options: TooltipOptions

	override update(renderer: string | RenderResultRenderer | null, options: Partial<TooltipOptions> = {}) {
		options = {...DefaultTooltipOptions, ...options}
		super.update(renderer ? this.popupRenderer.bind(this, renderer) : null, options)
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
		if (inSSR) {
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
		if (inSSR) {
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
