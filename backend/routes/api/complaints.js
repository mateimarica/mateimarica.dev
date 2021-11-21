const express = require('express'),
      router = express.Router(),
      mysql = require('mysql2'),
      bodyParser = require('body-parser');

router.get('/', (request, response) => {
	// TODO: Change this. Don't want to return the whole table
	connectionWrapper((database) => {
		database.query('SELECT * FROM complaints;', (err, result) => {
			if (err) throw err;
			response.json(result);
		});
	});
});

router.post('/', bodyParser.json(), (request, response) => {
	connectionWrapper((database) => {
		database.query(`INSERT INTO complaints (name, complaint) VALUES ('${request.body.name}', '${request.body.complaint}');`, (err, result) => {
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