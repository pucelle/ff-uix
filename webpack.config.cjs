//const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin')


module.exports = {
	entry: './docs/out/index.js',
	mode: 'development',
	output: {
		path: __dirname,
		filename: 'docs/js/bundle.js',
	},
	optimization: {
		usedExports: true,
		sideEffects: false,
	},
	plugins: [],
	devServer: {
		static: {
			directory: __dirname,
			watch: false,
		},
		historyApiFallback: {
			index: 'docs/index.html'
		},
		allowedHosts: 'all',
		open: ['docs/index.html'],
	},
	devtool: 'cheap-source-map',
	resolve: {
		extensions: ['.tsx', '.ts', '.js']
	},
	module: {
		rules: [
			{
				test: /\.js$/,
				loader: 'string-replace-loader',
				options: {
					search: /static style = .+/g, 
					replace: '',
				}
			}
		]
	}
}