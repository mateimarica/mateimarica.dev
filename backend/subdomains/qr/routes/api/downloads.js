const express = require('express'),
      router = express.Router(),
      rateLimit = require('express-rate-limit'),
      path = require('path'),
      fs = require('fs'),
      https = require('https');

const OPTIONS = {
	host: 'api.github.com',
	path: '/repos/mateimarica/qrequest/releases?per_page=1&page=1',
	method: 'GET',
	headers: {
		'accept': 'application/vnd.github.v3+json',
		'user-agent': process.env.QR_DOWNLOADS_RELEASES_USER_AGENT_HEADER
	}
};

let downloadInfo = {
	version: null,
	downloads: {
		windows: {
			name: null,
			size: 0,
			browser_download_url: null
		},
		linux: {
			name: null,
			size: 0,
			browser_download_url: null
		},
		macos: {
			name: null,
			size: 0,
			browser_download_url: null
		}
	}
};

const OS_EXTS = {
	windows: process.env.QR_EXT_WINDOWS,
	linux: process.env.QR_EXT_LINUX,
	macos: process.env.QR_EXT_MACOS
};

checkReleases();
setInterval(checkReleases, process.env.QR_DOWNLOADS_CHECK_RELEASES_INTERVAL_MINS * 60 * 1000);

// Pulls the latest releases and updates downloadInfo object
function checkReleases() {
	const req = https.request(OPTIONS, (res) => {
		if (res.statusCode !== 200) {
			console.log(`Couldn't retrieve latest QRequest releases from ${OPTIONS.host + OPTIONS.path}. Status code: ` + res.statusCode);
			return;
		}

		let body = '';
		res.on('data', (data) => {
			body += data;
		});

		res.on('end', () => {
			release = JSON.parse(body)[0]; // The array has length of 1
			downloadInfo.version = release.tag_name
			assets = release.assets;
			let osExtsRemaining = Object.assign({}, OS_EXTS);
			for (let i = 0; i < assets.length; i++) {
				for (let os in osExtsRemaining) {
					if (assets[i].name.endsWith(osExtsRemaining[os])) {
						downloadInfo.downloads[os] = {
							name: assets[i].name,
							size: assets[i].size,
							browser_download_url: assets[i].browser_download_url
						};
						delete osExtsRemaining[os];
					}
				}
			}

			// Set the remaining unchanged values
			for (let os in osExtsRemaining) {
				downloadInfo.downloads[os] = {
					name: null,
					size: 0,
					browser_download_url: null
				};
			}
		});
	});

	req.on('error', (err) => {
		console.error(err);
	});

	req.end();
}

const DOWNLOADS_RATE_LIMITER = rateLimit({
	windowMs: process.env.QR_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.QR_DOWNLOADS_LIMITER_MAX_REQUESTS,
	message: "Too many requests",
	headers: false
});

router.get('/', DOWNLOADS_RATE_LIMITER, (req, res) => {
	res.status(200).json(downloadInfo);
});

function getDownloadInfo() {
	return downloadInfo;
}

module.exports = { router, getDownloadInfo };