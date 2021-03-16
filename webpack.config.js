const webpack = require('webpack');
const slsw = require('serverless-webpack');

module.exports = (async () => {
	const accountId = await slsw.lib.serverless.providers.aws.getAccountId();
	return {
		mode: slsw.lib.webpack.isLocal ? 'development' : 'production',
		target: 'node',
		plugins: [
			new webpack.DefinePlugin({
				AWS_ACCOUNT_ID: `${accountId}`
			})
		],
		watchOptions: {
			poll: true
		},
		entry: slsw.lib.entries,
		devtool: slsw.lib.webpack.isLocal ? 'eval-cheap-module-source-map' : 'source-map',
		optimization: {
			minimize: false
		},
		performance: {
			hints: false
		},
		module: {
			rules: [
				{
					test: /\.js$/,
					loader: 'babel-loader',
					include: __dirname,
					exclude: /node_modules/
				}
			]
		}
	};
})();
