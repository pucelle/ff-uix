import {BoxLike, SizeLike} from 'ff-kit'


/** Parse svg code to get view box and svg inner. */
export function parseSVGCode(code: string): {box: BoxLike, size: SizeLike, inner: string} | null {
	let match = code.match(/<svg viewBox="(.+?)"(?: width="(\d+)")?(?: height="(\d+)")?>([\s\S]+?)<\/svg>/)
	if (!match) {
		return null
	}

	let viewBox = match[1].split(/[\s+]/).map(v => Number(v)) as [number, number, number, number]
	let width = match[2] ? Number(match[2]) : viewBox[2]
	let height = match[3] ? Number(match[3]) : viewBox[3]
	let inner = match[4]

	return {
		box: {
			x: viewBox[0],
			y: viewBox[1],
			width: viewBox[2],
			height: viewBox[3],
		},
		size: {
			width,
			height,
		},
		inner,
	}
}
