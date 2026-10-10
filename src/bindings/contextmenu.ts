import {RenderResultRenderer} from 'lupos.html'
import {popup, PopupOptions} from './popup'


const DefaultContextMenuOptions: Partial<PopupOptions> = {
	key: 'contextmenu',
	followEvents: true,
	trigger: 'contextmenu',
	position: 'tl-br',
	showDelay: 0,
	hideDelay: 100,
}


/** 
 * `:contextmenu` binding pops-up a context menu when right click bound element,
 * the context menu will be aligned to the position where you clicked.
 * 
 * `:contextmenu=${html`<ContextMenu>`}`
 * `:contextmenu=${() => html`<ContextMenu>`}, ?{...}`
 */
export class contextmenu extends popup {

	/** Currently showing contextmenu. */
	static current: contextmenu | null = null

	override update(renderer: RenderResultRenderer, options: Partial<PopupOptions> = {}) {
		options = {...DefaultContextMenuOptions, ...options}
		super.update(renderer, options)
	}

	protected override async doShow(): Promise<void> {
		await super.doShow()

		if (contextmenu.current && contextmenu.current !== this) {
			contextmenu.current.hidePopup(true)
		}

		contextmenu.current = this
	}

	protected override async doHide(immediately: boolean): Promise<void> {
		await super.doHide(immediately)

		if (contextmenu.current === this) {
			contextmenu.current = null
		}
	}
}
