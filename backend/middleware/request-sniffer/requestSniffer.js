'use strict';

const poolManager = require('pool-manager'),
      isValueInArray = require('binary-search');

let ipCache = [];
const pool = poolManager.getPool(process.env.DB_NAME);

async function initializeIpCache() {
	let sql = `SELECT ip FROM suspicious_ips ORDER BY ip ASC;`;

	pool.execute({sql: sql, rowsAsArray: true}, (err, result) => {
		if (err) {
			console.log('Failed to retrieve IP cache. ' + err);
			return;
		}

		ipCache = result.flat();
	});
}

function requestSniffer(req, res, next) {
	checkIpSuspiciousness(req, res);
	next();
}

async function checkIpSuspiciousness(req, res) {
	if (isValueInArray(req.socket.remoteAddress, ipCache)) {
		recordSuspiciousIP(req);
	} else {
		res.on('finish', () => {
			if (res.statusCode === 413 || res.statusCode === 401) {
				recordSuspiciousIP(req, res.statusCode);
			}
		});
	}
}

async function recordSuspiciousIP(req, statusCode=404, newVisits=1) {
	req.originalUrl = req.originalUrl.replaceAll("'", "''"); // Replace single quotes with double
	req.originalUrl = req.originalUrl.replace(/\s/g, ''); // Replace all (g) whitespace (\s)

	let sql = `INSERT INTO suspicious_ips (ip, res_code, first_endpoint) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE visits = visits + ?;`
	let params = [req.socket.remoteAddress, statusCode, (req.method + ' ' + req.originalUrl), newVisits];
	pool.execute(sql, params, () => {});
}

module.exports = { initializeIpCache, requestSniffer, recordSuspiciousIP };