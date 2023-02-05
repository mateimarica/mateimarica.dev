const minify = require('@node-minify/core'),
      gcc = require('@node-minify/google-closure-compiler'),
      csso = require('@node-minify/csso'),
      html_minifier = require('@node-minify/html-minifier'),
      path = require('path'),
      glob = require("glob"),
      svgo = require('svgo'),
      fs = require('fs');

// Exit handler since all function calls are async
process.on('exit', function(options, exitCode) {
	if (exitCode === 0 ) {
		console.log('Minification completed with no errors');
	} else {
		console.log('Minification failed');
	}
}.bind(null, { cleanup: true }));

// ================== Minifying JS, CSS, HTML ==================
const COMPRESSORS = [
	{
		compressor: gcc,
		ext: 'js'
	},
	{
		compressor: csso,
		ext: 'css'
	},
	{
		compressor: html_minifier,
		ext: 'html',
		options: {
			collapseWhitespace: true,
			conservativeCollapse: true
		}
	}
];

COMPRESSORS.forEach(e => {
	minify({
		compressor: e.compressor,
		input: `frontend_build/**/*.${e.ext}`,
		output: `$1.${e.ext}`,
		replaceInPlace: true,
		...(e.options && {options: e.options}),
		callback: (err, min) => {
			if (err) failProcess(`Error minifying ${e.ext.toUpperCase()}: ` + err);
			console.log('Minified ' + e.ext.toUpperCase());
		}
	});
});

// ================== Minifying SVG ==================
const filepaths = glob.sync("frontend_build/**/*.svg");

filepaths.forEach(filepath => {
	fs.readFile(filepath, (err, svgString) => {
		if (err) failProcess(`Error reading SVG at ${filepath}: ` + err);

		const svgoResult = svgo.optimize(svgString, {
			// optional but recommended field
			path: filepath,
			// all config fields are also available here
			multipass: true,
		});

		const optimizedSvgString = svgoResult.data;
		fs.writeFile(filepath, optimizedSvgString, (err) => {
			if (err) failProcess(`Error writing optimized SVG at ${filepath}: ` + err);
		});
	});
});

function failProcess(msg) {
	console.error(msg);
	process.exit(1);
}