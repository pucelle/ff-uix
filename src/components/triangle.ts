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
			fill: var(--popup-background);
		}

		.triangle-stroke{
			stroke-width: var(--popup-border-width);
			stroke: var(--popup-border-color);
			fill: none;
		}
	`

	/** Triangle width when triangle point to top position. */
	width: number = 10

	/** Triangle height when triangle point to top position. */
	height: number = 6

	/** The direction triangle's acute angle point to. */
	direction: 'top' | 'bottom' | 'left' | 'right' = 'top'

	protected override render() {
		let w = this.width
		let h = this.height
		let outputWidth = this.direction === 'top' || this.direction === 'bottom' ? w : h
		let outputHeight = this.direction === 'top' || this.direction === 'bottom' ? h : w
		let viewBox = [0, 0, outputWidth, outputHeight].join(' ')

		let p1 = new DOMPoint(0, h)
		let p2 = new DOMPoint(w / 2, 0)
		let p3 = new DOMPoint(w, h)

		let rotateAngle = this.direction === 'left'
			? 270
			: this.direction === 'bottom'
			? 180
			: this.direction === 'right'
			? 90
			: 0

		let m = new DOMMatrix()
		m.rotateSelf(0, 0, rotateAngle)

		p1 = p1.matrixTransform(m)
		p2 = p2.matrixTransform(m)
		p3 = p3.matrixTransform(m)

		let tx = Math.max(0, -p3.x)
		let ty = Math.max(0, -p3.y)

		p1.x += tx
		p1.y += ty
		p2.x += tx
		p2.y += ty
		p3.x += tx
		p3.y += ty

		let fillD = `M${p1.x} ${p1.y} L${p2.x} ${p2.y} L${p3.x} ${p3.y}Z`

		// Half of top triangle.
		let sita = Math.atan2(this.width / 2, this.height)
		let deltaY = 0.5 / Math.sin(sita)
		let sp1 = new DOMPoint(0, h + deltaY)
		let sp2 = new DOMPoint(w / 2, deltaY)
		let sp3 = new DOMPoint(w, h + deltaY)

		sp1 = sp1.matrixTransform(m)
		sp2 = sp2.matrixTransform(m)
		sp3 = sp3.matrixTransform(m)

		sp1.x += tx
		sp1.y += ty
		sp2.x += tx
		sp2.y += ty
		sp3.x += tx
		sp3.y += ty

		let strokeD = `M${sp1.x} ${sp1.y} L${sp2.x} ${sp2.y} L${sp3.x} ${sp3.y}`

		return html`
			<template class="triangle"
				style="${this.direction}: ${-this.height}px"
			>
				<svg viewBox=${viewBox}
					width=${outputWidth}
					height=${outputHeight}
				>
					<path class="triangle-fill" d=${fillD} />
					<path class="triangle-stroke" d=${strokeD} />
				</svg>
			</template>
		`
	}
}
