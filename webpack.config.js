const path = require('path');

const generateConfig = (extraTarget, outputFile, includeLibraries) => ({
    entry: './src/index.ts',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: outputFile,
        library: 'churchtoolsClient',
        libraryTarget: 'umd',
        globalObject: 'this'
    },
    mode: 'production',
    module: {
        rules: [
            {
                test: /.ts$/,
                use: [{
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            ['@babel/preset-env', {
                                'targets': {
                                    'ie': '11'
                                }
                            }]
                        ]
                    }
                }, { loader: 'ts-loader' }]
            }
        ]
    },
    externals: !includeLibraries ? {
        'axios': 'commonjs axios',
        'axios-logger': 'commonjs axios-logger'
    } : {},
    devtool: 'source-map',
    target: [extraTarget, 'es5'],
    resolve: {
        extensions: ['.ts', '.js']
    }
});

module.exports = [
    generateConfig('web', 'churchtools-client.js', false),
    generateConfig('web', 'churchtools-client.bundled.js', true)
];
