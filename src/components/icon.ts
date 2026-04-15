import {Component, html, css} from 'lupos.html'
import {parseSVGCode} from '../icons'


/** `<Icon>` renders a specified svg icon. */
export class Icon<Events = any> extends Component<Events> {

	static override style = css`
		.icon{
			display: inline-flex;
			justify-content: center;
			align-items: center;
			stroke: currentColor;
			fill: none;
			vertical-align: middle;
			position: relative;
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
	code: string = ''
	
	protected override render() {
		let parsed = parseSVGCode(this.code)
		if (!parsed) {
			return null
		}
	
		let {box, size, inner} = parsed
		let {x, y, width: viewWidth, height: viewHeight} = box
		let xScaleToView = viewWidth / size.width
		let yScaleToView = viewHeight / size.height

		if (this.width) {
			let widthChange = (this.width - size.width) * xScaleToView
			x -= widthChange / 2
			viewWidth += widthChange
		}

		if (this.height) {
			let heightChange = (this.height - size.height) * yScaleToView
			x -= heightChange / 2
			viewHeight += heightChange
		}

		let renderWidth = this.width ?? parsed.size.width ?? box.width
		let renderHeight = this.height ?? parsed.size.height ?? box.height

		return html`
			<template class="icon">
				<svg
					viewBox=${[x, y, viewWidth, viewHeight].join(' ')}
					width=${renderWidth}
					height=${renderHeight}
					:html=${inner}
				></svg>
			</template>
		`
	}
}
