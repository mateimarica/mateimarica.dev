const express = require('express'),
      router = express.Router(),
      mysql = require('mysql2'),
      bodyParser = require('body-parser');

router.get('/', (request, response) => {
	let sql = `SELECT name, complaint, created_at FROM complaints WHERE is_approved ORDER BY created_at DESC LIMIT 4;`;

	connectionWrapper((database) => {
		database.query(sql, (err, result) => {
			if (err) throw err;
			response.json(result);
		});
	});
});

router.post('/', bodyParser.json(), (request, response) => {

	request.body.complaint = request.body.complaint.replace("'", "''"); // Replace single quotes with double

	let sql = '';
	if (request.body.name.length > 0) {
		sql = `INSERT INTO complaints (name, complaint) VALUES ('${request.body.name}', '${request.body.complaint}');`;
	} else {
		sql = `INSERT INTO complaints (complaint) VALUES ('${request.body.complaint}');`;
	}

	connectionWrapper((database) => {
		database.query(sql, (err, result) => {
			if (err) throw err;
			console.log('Successfully inserted complaint into database: ' + JSON.stringify(request.body));
		});
	});
});

function connectionWrapper(callback) {
	let database = mysql.createConnection({
		host: process.env.HOST,
		user: process.env.DB_USERNAME,
		password: process.env.DB_PASSWORD,
		database: process.env.DB_NAME
	});

	database.connect((err) => {
		if (err) throw err;
		console.log('Connected to database.');
		callback(database);
	});
}

module.exports = router;