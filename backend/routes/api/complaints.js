const express = require('express'),
      router = express.Router(),
      mysql = require('mysql2'),
	  path = require('path'),
      bodyParser = require('body-parser'),
      nodemailer = require('nodemailer'),
	  dateFormatter = require('../../helpers/dateFormatter'),
	  templateEngine = require('../../helpers/templateEngine');

// GET endpoint is called automatically when the webpage loads
router.get('/', (request, response) => {
	connectionWrapper(response, (database) => {
		let sql = `SELECT name, complaint, created_at FROM complaints WHERE is_approved ORDER BY created_at DESC LIMIT 4;`;

		database.query(sql, (err, result) => {
			if (err) {
				console.log(err);
				response.sendStatus(500);
				return;
			}
			response.statusCode = 200;
			response.json(result);
		});
	});
});

// POST endpoint is called on submission of complaint form
router.post('/', bodyParser.json(), (request, response) => {
	connectionWrapper(response, (database) => {

		request.body.complaint = request.body.complaint.replace("'", "''"); // Replace single quotes with double

		// Check if the name is truthy. If it's undefined (no name key in the JSON) or empty string (user submitted with empty name field),
		// then no name will be put into the database and the database automatically sets the name to "Anonymous"
		let sql = '';
		if (request.body.name) {
			sql = `INSERT INTO complaints (name, complaint) VALUES ('${request.body.name}', '${request.body.complaint}');`;
		} else {
			sql = `INSERT INTO complaints (complaint) VALUES ('${request.body.complaint}');`;
		}
	
		sql += `SELECT name, complaint, temp_approval_id, created_at FROM complaints WHERE id=(SELECT MAX(id) FROM complaints WHERE is_approved=0) LIMIT 1;`

		database.query(sql, (err, result) => {
			if (err) {
				console.log(err);
				response.sendStatus(500);
				return;
			}

			console.log('Inserted complaint into database: ' + JSON.stringify(request.body));
			response.sendStatus(201); // New resource created

			// Send the 1st complaint (only 1 was queried) of the 2nd result set (two queries was sent)
			sendComplaintForApproval(result[1][0], request);
		});
	}, true);
});

router.get('/approve', (request, response) => {
	if (!request.query.approval_id || !request.query.approved || (request.query.approved != '0' && request.query.approved != '1')) {
		response.sendStatus(400);
		return;
	}

	connectionWrapper(response, (database) => {

		let sql = `UPDATE complaints SET is_approved=${request.query.approved}, temp_approval_id=NULL WHERE temp_approval_id='${request.query.approval_id}';`

		database.query(sql, (err, result) => {
			if (err) {
				console.log(err);
				response.sendStatus(500);
				return;
			} else if (result.affectedRows === 0) {
				response.sendStatus(403);
				return;
			}
				
			console.log("A complaint's approval was changed");

			let header = '\u2714';
			let message = (request.query.approved === '1' ? 'Approval' : 'Rejection') + " successful";

			const approvalConfirmationHTML = templateEngine.fillHTML(
				path.join(__dirname, '../../components/approvalConfirmation.html'),
				{
					header: header,
					message: message
				}
			);
		
			response.set('Content-Type', 'text/html');
			response.status(200).send(approvalConfirmationHTML);
		});
	});
});

function connectionWrapper(response, callback, multipleStatements=false) {
	let database = mysql.createConnection({
		host: process.env.HOST,
		user: process.env.DB_USERNAME,
		password: process.env.DB_PASSWORD,
		database: process.env.DB_NAME,
		multipleStatements: multipleStatements
	});

	database.connect((err) => {
		if (err) {
			response.sendStatus(502);
			return;
		}
		callback(database);
	});
}

async function sendComplaintForApproval(complaint, request) {
	const transporter = nodemailer.createTransport({
		service: process.env.EMAIL_SERVICE,
		port: 587,
		secure: true, // use TLS
		auth: {
			user: process.env.EMAIL_USERNAME,
			pass: process.env.EMAIL_PASSWORD
		}
	});
	
	const hostURL = `${request.protocol}://${request.get('host') + '/api/complaints/approve'}`;

	const approveButtonURL = new URL(hostURL);
	approveButtonURL.searchParams.append('approval_id', complaint.temp_approval_id);
	approveButtonURL.searchParams.append('approved', 1);

	const rejectButtonURL = new URL(hostURL);
	rejectButtonURL.searchParams.append('approval_id', complaint.temp_approval_id);
	rejectButtonURL.searchParams.append('approved', 0);

	const emailContents = templateEngine.fillHTML(
		path.join(__dirname, '../../components/email.html'),
		{
			name: complaint.name,
			complaint: complaint.complaint,
			date: dateFormatter.formatDate(complaint.created_at),
			approveButtonURL: approveButtonURL.href,
			rejectButtonURL: rejectButtonURL.href
		}
	)

	const email = {
		from: process.env.EMAIL_USERNAME,
		to: process.env.EMAIL_RECIPIENT,
		subject: 'Complaint reviewal required',
		html: emailContents
	};

	transporter.sendMail(email, (err, info) => {
		if (error) {
			console.log(err);
		} else {
			console.log('Approval email sent: ' + info.response);
		}
	});
}



module.exports = router;