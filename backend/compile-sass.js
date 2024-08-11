'use strict';

const sass = require('sass'),
      glob = require('glob'),
      fs = require('fs'),
      path = require('path');

let fileCount = 0;

function failProcess(msg) {
	console.error('\n' + msg);
	process.exit(1);
}

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
	fs.writeFile(outputPath, result.css, (writeError) => {
		if (writeError) failProcess(`Error writing compiled SASS at ${filepath}: ${writeError}\n`);

		// Delete original SASS/SCSS file from frontend_build
		fs.unlink(filepath, (unlinkError) => {
			if (unlinkError) failProcess(`Error deleting original SASS at ${filepath}: ${unlinkError}\n`);
		});

		fileCount++;
	});
});