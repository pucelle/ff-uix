import {css, html, fade} from 'lupos.html'
import {ThemeSize} from '../style'
import {Popup} from './popup'
import {Icon} from './icon'
import {Triangle} from './triangle'
import {IconClose} from '../icons'


/** 
 * Tooltip type:
 * - `default`: when mouse hover to trigger.
 * - `prompt`: show by default and can be closed.
 * - `error`: always show if having error.
 */
export type TooltipType = 'default' | 'prompt' | 'error'


/** `<Tooltip>` displays a short text or html content beside it's trigger element. */
export class Tooltip<E = {}> extends Popup<E> {

	static override style = css`
		.tooltip{
			display: flex;
			max-width: 16em;
			padding: 0.4em 0.8em;
			line-height: 1.4;
			color: var(--tooltip-text-color);
		}

		.tooltip-text{
			flex: 1;
			min-width: 0;
			font-size: 0.928em;
		}

		.tooltip-close{
			display: flex;
			width: 1lh;
			height: 1lh;
			margin-right: -0.4em;
			margin-left: 0.2em;
			cursor: pointer;

			&:active{
				transform: translateY(1px);
			}

			.icon{
				margin: auto;
			}
		}

		.tooltip-type-default{
			background: var(--tooltip-background-color);
			color: var(--tooltip-text-color);

			.tooltip-triangle{
				fill: var(--tooltip-background-color);
			}
		}

		.tooltip-type-prompt{
			background: var(--text-color);
			color: var(--background-color);
			pointer-events: auto;

			.tooltip-triangle{
				fill: var(--text-color);
			}
		}

		.tooltip-type-error{
			background: var(--error-color);
			color: #fff;

			.tooltip-triangle{
				fill: var(--error-color);
			}
		}
	`

	
	size: ThemeSize = 'default'

	triangleWidth: number = 10
	triangleHeight: number = 6

	/** 
	 * Tooltip type:
	 * 
	 * `default`: when mouse hover to trigger.
	 * `prompt`: shows be default and can be closed.
	 * `error`: always show if having error.
	 */
	type: TooltipType = 'default'

	protected override render() {
		return html`
			<template class="popup tooltip size-${this.size} tooltip-type-${this.type}"
				:transition.immediate=${fade()}
			>
				<lu:if ${this.triangle}>
					<Triangle class="tooltip-triangle"
						.direction=${this.triangleDirection}
						.width=${this.triangleWidth}
						.height=${this.triangleHeight}
					/>
				</lu:if>

				<div class="tooltip-text">
					<slot />
				</div>

				<lu:if ${this.type === 'prompt'}>
					<div class="tooltip-close"
						@click=${this.close}
					>
						<Icon .icon=${IconClose} />
					</div>
				</lu:if>
			</template>
		`
	}
}

