import {Coord, NumberUtils} from 'ff-kit'
import {css, Component, html} from 'lupos.html'


/** `<Triangle>` renders a small triangular indicator, typically used within `<Popup>` or `<Tooltip>`. */
export class Triangle<E = {}> extends Component<E> {

	static override style = css`
		.triangle{
			position: absolute;
		}

		.triangle svg{
			display: block;
		}

		.triangle-fill{
			stroke: none;
			fill: var(--background);
		}

		.triangle-stroke{
			stroke-width: var(--popup-border-width);
			stroke: var(--popup-border-color);
			fill: none;
		}
	`

	/** Triangle width when triangle point to top position. */
	width: number = 12

	/** Triangle height when triangle point to top position. */
	height: number = 6

	/** The direction triangle's acute angle point to. */
	direction: 'top' | 'bottom' | 'left' | 'right' = 'top'

	protected override render() {
		let w = this.width
		let h = this.height
		let isVertical = this.direction === 'top' || this.direction === 'bottom'
		
		let outputWidth = isVertical ? w : h
		let outputHeight = isVertical ? h : w
		let viewBox = `0 0 ${outputWidth} ${outputHeight}`

		// Calculation for stroke offset
		let sita = Math.atan2(w / 2, h)
		let deltaY = 0.5 / Math.sin(sita)

		// Points for Fill
		let p1 = this.transformPoint(0, h, w, h)
		let p2 = this.transformPoint(w / 2, 0, w, h)
		let p3 = this.transformPoint(w, h, w, h)

		// Points for Stroke
		let sp1 = this.transformPoint(0, h + deltaY, w, h)
		let sp2 = this.transformPoint(w / 2, deltaY, w, h)
		let sp3 = this.transformPoint(w, h + deltaY, w, h)

		let fillD = `M${p1.x} ${p1.y} L${p2.x} ${p2.y} L${p3.x} ${p3.y}Z`
		
		let strokeD = `M${NumberUtils.toDecimal(sp1.x, 3)} ${NumberUtils.toDecimal(sp1.y, 3)} ` +
					  `L${NumberUtils.toDecimal(sp2.x, 3)} ${NumberUtils.toDecimal(sp2.y, 3)} ` +
					  `L${NumberUtils.toDecimal(sp3.x, 3)} ${NumberUtils.toDecimal(sp3.y, 3)}`

		return html`
			<template class="triangle" style="${this.direction}: ${-this.height}px">
				<svg viewBox=${viewBox} width=${outputWidth} height=${outputHeight}>
					<path class="triangle-fill" d=${fillD} />
					<path class="triangle-stroke" d=${strokeD} />
				</svg>
			</template>
		`
	}

	private transformPoint(x: number, y: number, w: number, h: number): Coord {
		switch (this.direction) {
			case 'bottom': return {x: w - x, y: h - y } // 180°
			case 'left':   return {x: y, y: w - x } 	// 270°
			case 'right':  return {x: h - y, y: x} 		// 90°
			default:	   return {x, y} 				// 0°
		}
	}
}
