import {css, Component, html, RenderResult, fade} from 'lupos.html'
import {Triangle} from './triangle'
import * as SharedPopups from '../bindings/popup-helpers/shared-popups'


/** 
 * `<Popup>` represents the container of popup content.
 * `<Popup>` should be contained by a `<lu:portal>` when rendering.
 */
export class Popup<E = {}> extends Component<E> {

	static override style = css`
		.popup{

			/* Recently, until chrome 133, fixed layout with anchor positioning is not work when page can scroll. */
			position: absolute;

			left: 0;
			top: 0;
			background: var(--popup-background);
			border-radius: var(--popup-border-radius);
			border: var(--popup-border-width) solid var(--popup-border-color);

			/** Avoid becoming narrower after alignment when touches page edges. */
			width: max-content;

			max-width: calc(100vw - 20px);
			max-height: calc(100vh - 20px);

			/* 
			Same with window type components, so if inside of a window,
			we must move it behind the window.
			*/
			z-index: 1000;

			/* 3px drop shadow nearly equals 6px of box-shadow. */
			filter: drop-shadow(0 0 calc(var(--popup-shadow-blur-radius)) var(--popup-shadow-color));

			/** Fix background mix color. */
			--background: var(--popup-background);
		}
	`

	/** Default triangle width, the size of bottom side of the triangle. */
	static triangleWidth: number = 12

	/** Default triangle height, the size of height of the triangle. */
	static triangleHeight: number = 6
	

	/** Whether shows triangle element. */
	triangle: boolean = true

	/** The direction triangle acute angle point to. */
	triangleDirection: 'top' | 'bottom' | 'left' | 'right' = 'top'

	/** Triangle width, the size of bottom side of the triangle. */
	triangleWidth: number = Popup.triangleWidth

	/** Triangle height, the size of height of the triangle. */
	triangleHeight: number = Popup.triangleHeight

	/** 
	 * Get the trigger element, which cause current popup pop-up.
	 * Only exist after current popup get popped-up.
	 */
	getTriggerElement(): HTMLElement | null {
		let binding = SharedPopups.getPopupUser(this)
		if (binding) {
			return binding.el
		}
		else {
			return null
		}
	}

	protected override render(): RenderResult {
		return html`
			<template class="popup" tabindex="0"
				:transition.immediate=${fade()}
			>
				<lu:if ${this.triangle}>
					<Triangle
						.width=${this.triangleWidth}
						.height=${this.triangleHeight}
						.direction=${this.triangleDirection}
					/>
				</lu:if>
				<slot />
			</template>
		`
	}

	/** Close current popup. */
	close() {
		let binding = SharedPopups.getPopupUser(this)
		if (binding) {
			binding.hidePopup()
		}
	}
}
