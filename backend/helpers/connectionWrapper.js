const mysql = require('mysql2');

function connectionWrapper(callback, response=null, multipleStatements=false) {
	let database = mysql.createConnection({
		host: process.env.HOST,
		user: process.env.DB_USERNAME,
		password: process.env.DB_PASSWORD,
		database: process.env.DB_NAME,
		multipleStatements: multipleStatements
	});

	database.connect((err) => {
		if (err) {
			if (response !== null) response.sendStatus(502);
			return;
		}
		callback(database);
	});
}

module.exports = connectionWrapper;