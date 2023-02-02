const minify = require('@node-minify/core'),
      gcc = require('@node-minify/google-closure-compiler'),
      csso = require('@node-minify/csso'),
      html_minifier = require('@node-minify/html-minifier'),
      path = require('path'),
      glob = require("glob"),
      svgo = require('svgo'),
      fs = require('fs');

let errors = 0;

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
		sync: true,
		...(e.options && {options: e.options}),
		callback: (err, min) => {
			if (err) {
				console.error(`Error minifying ${e.ext.toUpperCase()}: ` + err);
				errors++;
			}
		}
	});
});

// ================== Minifying SVG ==================
const filepaths = glob.sync("frontend_build/**/*.svg");

filepaths.forEach(filepath => {
	try {
		const svgString = fs.readFileSync(filepath, 'utf8');

		const svgoResult = svgo.optimize(svgString, {
			// optional but recommended field
			path: filepath,
			// all config fields are also available here
			multipass: true,
		});

		const optimizedSvgString = svgoResult.data;
		fs.writeFileSync(filepath, optimizedSvgString);
	} catch (err) {
		console.error('Error minifying SVG: ' + err);
		errors++;
	}
});

console.log(`Minification ${errors > 0 ? 'failed' : 'completed'} with ${errors === 0 ? 'no' : errors} error${errors === 1 ? '' : 's'}`);

if (errors > 0) {
	process.exit(1);
}