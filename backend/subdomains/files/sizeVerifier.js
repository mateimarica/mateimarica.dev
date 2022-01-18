const poolManager = require('pool-manager');

const FILES_MAX_STORAGE_BYTES = process.env.FILES_MAX_STORAGE_GBS * 1000000000;

const pool = poolManager.getPool('files_db');

let sql = `SELECT SUM(size) AS size FROM files`;
function sizeVerifier(req, res, next) {
	pool.execute(sql, (err, results) => {
		if (err) {
			console.log(err);
			return sendStatus(502);
		}
		
		if (Number(results[0].size) + Number(req.get('Content-Length')) > FILES_MAX_STORAGE_BYTES) {
			return res.sendStatus(413);
		}

		next();
	});
}

module.exports = { sizeVerifier, FILES_MAX_STORAGE_BYTES }