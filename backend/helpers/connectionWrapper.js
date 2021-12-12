const mysql = require('mysql2');

function connectionWrapper(callback, res=null, multipleStatements=false) {
	let connection = mysql.createConnection({
		host: process.env.HOST,
		user: process.env.DB_USERNAME,
		password: process.env.DB_PASSWORD,
		database: process.env.DB_NAME,
		multipleStatements: multipleStatements
	});

	connection.connect((err) => {
		if (err) {
			if (res !== null) res.sendStatus(502);
			console.error('Database connection failed. ' + err);
			return;
		}
		callback(connection);
	});
}

module.exports = connectionWrapper;