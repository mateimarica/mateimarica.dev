const express = require('express'),
      router = express.Router(),
      path = require('path'),
      nodemailer = require('nodemailer'),
      rateLimit = require("express-rate-limit"),
      dateFormatter = require('../../helpers/dateFormatter'),
      templateEngine = require('../../helpers/templateEngine'),
	  connectionWrapper = require('../../helpers/connectionWrapper');

// GET endpoint is called automatically when the webpage loads
router.get('/', (req, res) => {
	connectionWrapper((database) => {
		let sql = `SELECT name, complaint, created_at FROM complaints WHERE is_approved ORDER BY created_at DESC LIMIT 4;`;

		database.query(sql, (err, result) => {
			if (err) {
				console.log(err);
				res.sendStatus(500);
				return;
			}
			res.statusCode = 200;
			res.json(result);
		});
	}, res);
});

const COMPLAINT_RATE_LIMITER = rateLimit({
	windowMs: process.env.COMPLAINT_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.COMPLAINT_LIMITER_MAX_REQUESTS,
	message: "You already submitted a complaint recently.<br>Surely I'm not that awful.",
	headers: false
});

// POST endpoint is called on submission of complaint form
router.post('/', COMPLAINT_RATE_LIMITER, (req, res) => {
	if ((req.body.name && req.body.name.length > 20) || !req.body.complaint || (req.body.complaint.length > 400)) {
		res.sendStatus(400);
		return;
	}

	connectionWrapper((database) => {

		req.body.complaint = req.body.complaint.replaceAll("'", "''"); // Replace single quotes with double

		// Check if the name is truthy. If it's undefined (no name key in the JSON) or empty string (user submitted with empty name field),
		// then no name will be put into the database and the database automatically sets the name to "Anonymous"
		let sql = '';
		if (req.body.name) {
			sql = `INSERT INTO complaints (name, complaint) VALUES ('${req.body.name}', '${req.body.complaint}');`;
		} else {
			sql = `INSERT INTO complaints (complaint) VALUES ('${req.body.complaint}');`;
		}
	
		sql += `SELECT name, complaint, temp_approval_id, created_at FROM complaints WHERE id=(SELECT MAX(id) FROM complaints WHERE is_approved=0) LIMIT 1;`

		database.query(sql, (err, result) => {
			if (err) {
				console.log(err);
				res.sendStatus(500);
				return;
			}

			console.log('Inserted complaint into database: ' + JSON.stringify(req.body));
			res.sendStatus(201); // New resource created

			// Send the 1st complaint (only 1 was queried) of the 2nd result (two queries were sent)
			sendComplaintForApproval(result[1][0], req);
		});
	}, res, true);
});

router.get('/approve', (req, res) => {
	if (!req.query.approval_id || !req.query.approved || (req.query.approved != '0' && req.query.approved != '1')) {
		res.sendStatus(400);
		return;
	}

	connectionWrapper((database) => {

		let sql = `UPDATE complaints SET is_approved=${req.query.approved}, temp_approval_id=NULL WHERE temp_approval_id='${req.query.approval_id}';`

		database.query(sql, (err, result) => {
			if (err) {
				console.log(err);
				res.sendStatus(500);
				return;
			} else if (result.affectedRows === 0) {
				res.sendStatus(403);
				return;
			}
				
			console.log("A complaint's approval was changed");

			let header = '\u2714';
			let message = (req.query.approved === '1' ? 'Approval' : 'Rejection') + " successful";

			const approvalConfirmationHTML = templateEngine.fillHTML(
				path.join(__dirname, '../../components/approvalConfirmation.html'),
				{
					header: header,
					message: message
				}
			);
		
			res.set('Content-Type', 'text/html');
			res.status(200).send(approvalConfirmationHTML);
		});
	}, res);
});

async function sendComplaintForApproval(complaint, req) {
	if (!process.env.EMAIL_SERVICE || !process.env.EMAIL_USERNAME || !process.env.EMAIL_PASSWORD || !process.env.EMAIL_RECIPIENT) {
		return;
	}

	const transporter = nodemailer.createTransport({
		service: process.env.EMAIL_SERVICE,
		port: 587,
		secure: true, // use TLS
		auth: {
			user: process.env.EMAIL_USERNAME,
			pass: process.env.EMAIL_PASSWORD
		}
	});
	
	const hostURL = `${req.protocol}://${req.get('host') + '/api/complaints/approve'}`;

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