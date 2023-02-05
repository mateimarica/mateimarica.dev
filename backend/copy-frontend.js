const fs = require('fs'),
      path = require('path');

const frontendDir = path.join(__dirname, '..', 'frontend');
const frondendBuildDir = path.join(__dirname, 'frontend_build');

try {
	fs.rmSync(frondendBuildDir, { recursive: true, force: true });
	fs.cpSync(frontendDir, frondendBuildDir, { recursive: true });
} catch (err) {
	console.log("Failed to replace frontend_build: " + err);
	process.exit(1);
}

console.log("Successfully replaced frontend_build");