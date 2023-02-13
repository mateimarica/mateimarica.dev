const minify = require('@node-minify/core'),
      gcc = require('@node-minify/google-closure-compiler'),
      csso = require('@node-minify/csso'),
      html_minifier = require('@node-minify/html-minifier'),
      jsonminify = require('@node-minify/jsonminify'),
      path = require('path'),
      glob = require("glob"),
      svgo = require('svgo'),
      fs = require('fs');

// Exit handler since all function calls are async
process.on('exit', function(options, exitCode) {
	if (exitCode === 0) {
		console.log('\nMinification completed with no errors');
	} else {
		console.log('\nMinification failed');
	}
}.bind(null, { cleanup: true }));

process.stdout.write('Minified');

// ================== Minifying JS, CSS, HTML ==================
const FORMATS = [
	{
		compressor: gcc,
		exts: ['js']
	},
	{
		compressor: csso,
		exts: ['css']
	},
	{
		compressor: html_minifier,
		exts: ['html'],
		options: {
			collapseWhitespace: true,
			conservativeCollapse: true
		}
	},
	{
		compressor: jsonminify,
		exts: ['json', 'webmanifest']
	}
];

FORMATS.forEach(format => {
	format.exts.forEach(ext => {
		minify({
			compressor: format.compressor,
			input: `frontend_build/**/*.${ext}`,
			output: `$1.${ext}`,
			replaceInPlace: true,
			...(format.options && {options: format.options}),
			callback: (err, min) => {
				if (err) failProcess(`Error minifying ${ext.toUpperCase()}: ` + err);
				process.stdout.write(' ' + ext.toUpperCase());
			}
		});
	})
});

// ================== Minifying SVG ==================
const svgFilepaths = glob.sync("frontend_build/**/*.svg");
let svgsMinified = 0;

svgFilepaths.forEach(filepath => {
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
			if (++svgsMinified === svgFilepaths.length) process.stdout.write(' SVG'); // This is ugly af
		});
	});
});

function failProcess(msg) {
	console.error(msg);
	process.exit(1);
}