// Replace all mateimarica.dev links in html files with a local link, for local development
module.exports = {
	files: '../frontend/build/**/*.html',
	from: /mateimarica.dev/g,
	to: 'mateimarica.local:5000',
};