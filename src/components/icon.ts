import {Component, html, css} from 'lupos.html'
import {parseSVGCode} from '../icons'


/** `<Icon>` renders a specified svg icon. */
export class Icon<Events = any> extends Component<Events> {

	static override style = css`
		.icon{
			display: inline-flex;
			stroke: currentColor;
			fill: none;
			vertical-align: middle;
			position: relative;

			svg{
				width: 100%;
				height: 100%;
			}
		}
	`


	/** Render size, by default is svg source width. */
	width: number | null = null
	
	/** Render size, bu default is svg source height. */
	height: number | null = null

	
	/** 
	 * Icon code.
	 * See `/icons` for all icons available.
	 */
	icon: string = ''
	
	protected override render() {
		let parsed = parseSVGCode(this.icon)
		if (!parsed) {
			return null
		}
	
		let {box: {x, y, width, height}, inner} = parsed
		x += this.width ? (width - this.width) / 2 : 0
		y += this.height ? (height - this.height) / 2 : 0

		let renderWidth = this.width ?? width
		let renderHeight = this.height ?? height

		let style = {
			width: renderWidth + 'px',
			height: renderHeight + 'px',
		}

		return html`
			<template class="icon"
				:style=${style}
			>
				<svg
					viewBox=${[x, y, renderWidth, renderHeight].join(' ')}
					:html=${inner}
				></svg>
			</template>
		`
	}
}
