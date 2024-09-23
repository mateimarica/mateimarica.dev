'use strict';

const poolManager = require('pool-manager');

const FILES_MAX_STORAGE_BYTES = process.env.FILES_MAX_STORAGE_GBS * 1000000000;

const pool = poolManager.getPool('files_db');

const sql = `SELECT (SELECT IFNULL(SUM(size), 0) FROM files) AS usedSpaceSystem, (SELECT IFNULL(SUM(size), 0) FROM files WHERE uploader=?) AS usedSpaceUser, (SELECT space FROM users WHERE username=?) AS totalSpaceUser;`;

const systemFullMsg = `The server has run out of storage. Contact Matei.`;
const userFullMsg = `You do not have enough space for this.`;

function sizeVerifier(req, res, next) {
	const username = req.headers['Username'];
	const params = [username, username];
	pool.execute(sql, params, (err, results) => {
		if (err) {
			console.log(err);
			return sendStatus(502);
		}

		const contentLength = Number(req.get('Content-Length'));

		if (Number(results[0].usedSpaceSystem) + contentLength > FILES_MAX_STORAGE_BYTES) {
			return res.status(413).send(systemFullMsg);
		}

		if (Number(results[0].usedSpaceUser) + contentLength > Number(results[0].totalSpaceUser)) {
			return res.status(413).send(userFullMsg);
		}

		next();
	});
}

function enoughSpace(desiredSpaceBytes, username, res, callback) {
	const params = [username, username];
	pool.execute(sql, params, (err, results) => {
		if (err) {
			res.sendStatus(502);
			callback(false);
			return;
		}

		if (Number(results[0].usedSpaceSystem) + desiredSpaceBytes > FILES_MAX_STORAGE_BYTES) {
			res.status(413).send(systemFullMsg);
			callback(false);
			return;
		}

		if (Number(results[0].usedSpaceUser) + desiredSpaceBytes > Number(results[0].totalSpaceUser)) {
			res.status(413).send(userFullMsg);
			callback(false);
			return;
		}

		callback(true);
	});
}

module.exports = { sizeVerifier, enoughSpace, FILES_MAX_STORAGE_BYTES }