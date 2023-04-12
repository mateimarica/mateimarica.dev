'use strict';

const sass = require('sass'),
      glob = require('glob'),
      fs = require('fs'),
      path = require('path');

let fileCount = 0;

// Exit handler since fileWrites are async
process.on('exit', function(options, exitCode) {
	if (exitCode === 0) {
		console.log(`SASS compilation completed (${fileCount} files)`);
	} else {
		console.log('SASS compilation failed');
	}
}.bind(null, { cleanup: true }));

const filepaths = glob.sync('frontend_build/**/*.{scss,sass}');

// Compile sass/scss and save as css file
filepaths.forEach(filepath => {
	const result = sass.compile(filepath);
	const parsedPath = path.parse(filepath);
	const outputPath = path.join(parsedPath.dir, parsedPath.name).toString() + '.css';
	fs.writeFile(outputPath, result.css, (err) => {
		if (err) failProcess(`Error writing compiled SASS at ${filepath}: ${err}\n`);
		fileCount++;
	});
});