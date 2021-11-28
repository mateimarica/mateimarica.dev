const express = require('express'),
      router = express.Router(),
      mysql = require('mysql2'),
      bodyParser = require('body-parser');

// GET endpoint is called automatically when the webpage loads
router.get('/', (request, response) => {
	let sql = `SELECT name, complaint, created_at FROM complaints WHERE is_approved ORDER BY created_at DESC LIMIT 4;`;

	connectionWrapper(response, (database) => {
		database.query(sql, (err, result) => {
			response.statusCode = 200;
			response.json(result);
		});
	});
});

// POST endpoint is called on submission of complaint form
router.post('/', bodyParser.json(), (request, response) => {

	request.body.complaint = request.body.complaint.replace("'", "''"); // Replace single quotes with double

	// Check if the name is truthy. If it's undefined (no name key in the JSON) or empty string (user submitted with empty name field),
	// then no name will be put into the database and the database automatically sets the name to "Anonymous"
	let sql = '';
	if (request.body.name) {
		sql = `INSERT INTO complaints (name, complaint) VALUES ('${request.body.name}', '${request.body.complaint}');`;
	} else {
		sql = `INSERT INTO complaints (complaint) VALUES ('${request.body.complaint}');`;
	}

	connectionWrapper(response, (database) => {
		database.query(sql, (err, result) => {
			console.log('Successfully inserted complaint into database: ' + JSON.stringify(request.body));
			response.sendStatus(201); // New resourced created
		});
	});
});

function connectionWrapper( response, callback) {
	let database = mysql.createConnection({
		host: process.env.HOST,
		user: process.env.DB_USERNAME,
		password: process.env.DB_PASSWORD,
		database: process.env.DB_NAME
	});

	database.connect((err) => {
		if (err) {
			response.sendStatus(502);
			return;
		}
		callback(database);
	});
}

module.exports = router;