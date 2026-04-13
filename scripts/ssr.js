import {SSR} from 'lupos.html/ssr'
import * as fs from 'node:fs'
import {Preview} from '../docs/out/index.js'


async function renderIndex() {
	let ssr = new SSR('/')
		
	let code = await ssr.renderComponentToString(Preview)

	// Read page template, only for debugging.
	let template = fs.readFileSync('./docs/index-template.html', 'utf-8')
	let html = template.replace(/<ff-uix-preview><\/ff-uix-preview>/, code)

	fs.writeFileSync('./docs/index.html', html)
}

renderIndex()