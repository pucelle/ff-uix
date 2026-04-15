import {BoxLike, SizeLike} from 'ff-kit'

export {default as IconCheckboxChecked} from '../../icons/checkbox-checked.svg'
export {default as IconCheckboxIndeterminate} from '../../icons/checkbox-indeterminate.svg'
export {default as IconCheckboxUnchecked} from '../../icons/checkbox-unchecked.svg'
export {default as IconChecked} from '../../icons/checked.svg'
export {default as IconClose} from '../../icons/close.svg'
export {default as IconConfirm} from '../../icons/confirm.svg'
export {default as IconDown} from '../../icons/down.svg'
export {default as IconError} from '../../icons/error.svg'
export {default as IconInfo} from '../../icons/info.svg'
export {default as IconLeft} from '../../icons/left.svg'
export {default as IconLove} from '../../icons/love.svg'
export {default as IconOrderAsc} from '../../icons/order-asc.svg'
export {default as IconOrderDefault} from '../../icons/order-default.svg'
export {default as IconOrderDesc} from '../../icons/order-desc.svg'
export {default as IconRadioChecked} from '../../icons/radio-checked.svg'
export {default as IconRadioUnchecked} from '../../icons/radio-unchecked.svg'
export {default as IconRight} from '../../icons/right.svg'
export {default as IconSearch} from '../../icons/search.svg'
export {default as IconSuccess} from '../../icons/success.svg'
export {default as IconTips} from '../../icons/tips.svg'
export {default as IconTriangleDown} from '../../icons/triangle-down.svg'
export {default as IconTriangleRight} from '../../icons/triangle-right.svg'
export {default as IconWarning} from '../../icons/warning.svg'
export {default as IconRefresh} from '../../icons/refresh.svg'
export {default as IconUp} from '../../icons/up.svg'


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
