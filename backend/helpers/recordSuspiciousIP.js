const connectionWrapper = require('./connectionWrapper');

function recordSuspiciousIP(request) {
	connectionWrapper((database) => {
		request.originalUrl = request.originalUrl.replace("'", "''"); // Replace single quotes with double
		let sql = `INSERT INTO suspicious_ips (ip, first_endpoint) VALUES ('${request.socket.remoteAddress}', '${request.method + ' ' + request.originalUrl}') ON DUPLICATE KEY UPDATE visits = visits + 1;`
		database.query(sql);
	});
}

module.exports = recordSuspiciousIP;