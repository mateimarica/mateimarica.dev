'use strict';

const express = require('express'),
      router = express.Router(),
      path = require('path'),
      mailWrapper = require('mail-wrapper'),
      rateLimit = require("express-rate-limit"),
      escape = require('escape-html'),
      dateFormatter = require('date-formatter'),
      poolManager = require('pool-manager');

require('@marko/compiler/register');

const pool = poolManager.getPool(process.env.DB_NAME);

// GET endpoint is called automatically when the webpage loads
router.get('/', (req, res) => {

	let sql = `SELECT name, complaint, created_at FROM complaints WHERE is_approved ORDER BY created_at DESC LIMIT 4;`;

	pool.execute(sql, (err, result) => {
		if (err) {
			console.log(err);
			return res.sendStatus(500);
		}
		res.statusCode = 200;
		res.json(result);
	});
});

const COMPLAINT_RATE_LIMITER = rateLimit({
	windowMs: process.env.COMPLAINT_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.COMPLAINT_LIMITER_MAX_REQUESTS,
	message: "You already submitted a complaint recently.\r\nSurely I'm not that awful.",
	headers: false
});

// POST endpoint is called on submission of complaint form
router.post('/', COMPLAINT_RATE_LIMITER, (req, res) => {
	if (!req.body || (req.body.name && req.body.name.length > 20) || !req.body.complaint || (req.body.complaint.length > 400)) {
		return res.sendStatus(400);
	}
	// Check if the name is truthy. If it's undefined (no name key in the JSON) or empty string (user submitted with empty name field),
	// then no name will be put into the database and the database automatically sets the name to "Anonymous"
	if (req.body.name) {
		var sql = `INSERT INTO complaints (name, complaint) VALUES (?, ?);`;
		var params = [req.body.name, req.body.complaint];
	} else {
		var sql = `INSERT INTO complaints (complaint) VALUES (?);`;
		var params = [req.body.complaint];
	}

	pool.execute(sql, params, (err, result) => {
		if (err) {
			console.log(err);
			return res.sendStatus(500);
		}

		res.sendStatus(201); // New resource created

		let sql2 = `SELECT name, complaint, temp_approval_id, created_at FROM complaints WHERE id=(SELECT MAX(id) FROM complaints WHERE is_approved=0) LIMIT 1;`
		pool.execute(sql2, (err2, result2) => {
			if (err2) {
				console.log(err2);
				return;
			}
			sendComplaintForApproval(result2[0], req);
		});
	});
});

const COMPLAINT_APPROVAL_RATE_LIMITER = rateLimit({
	windowMs: process.env.COMPLAINT_APPROVAL_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.COMPLAINT_APPROVAL_LIMITER_MAX_REQUESTS,
	message: "What are you doing?",
	headers: false,
	skipSuccessfulRequests: true
});

const approvalConfirmationTemplate = require('../../frontend_build/main_components/approvalConfirmation').default;
router.get('/approve', COMPLAINT_APPROVAL_RATE_LIMITER, (req, res) => {
	if (!req.query.approval_id || !req.query.approved || (req.query.approved !== '0' && req.query.approved !== '1')) {
		res.sendStatus(400);
		return;
	}

	let sql = `UPDATE complaints SET is_approved=?, temp_approval_id=NULL WHERE temp_approval_id=?;`
	let params = [req.query.approved, req.query.approval_id]

	pool.execute(sql, params, (err, result) => {
		if (err) {
			console.log(err);
			return res.sendStatus(500);
		} else if (result.affectedRows === 0) {
			return res.sendStatus(404);
		}

		let header = '\u2714'; // Check-mark symbol
		let message = (req.query.approved === '1' ? 'Approval' : 'Rejection') + " successful";

		const html = approvalConfirmationTemplate.renderToString({
			header: header,
			message: message
		});
	
		res.set('Content-Type', 'text/html');
		res.status(200).send(html);
	});
});

const complaintReviewTemplate = require('../../frontend_build/main_components/complaint_review_email').default;
async function sendComplaintForApproval(complaint, req) {
	if (!complaint || !req) {
		console.log(`Complaint couldn't be sent for approval. Info: complaint_str=${!!complaint} req_obj=${!!req}`);
		return;
	}
	
	const hostURL = `${req.protocol}://${req.get('host') + '/api/complaints/approve'}`;

	const approveButtonURL = new URL(hostURL);
	approveButtonURL.searchParams.append('approval_id', complaint.temp_approval_id);
	approveButtonURL.searchParams.append('approved', 1);

	const rejectButtonURL = new URL(hostURL);
	rejectButtonURL.searchParams.append('approval_id', complaint.temp_approval_id);
	rejectButtonURL.searchParams.append('approved', 0);

	const html = complaintReviewTemplate.renderToString({
		name: escape(complaint.name),
		complaint: escape(complaint.complaint),
		date: dateFormatter.formatDate(complaint.created_at),
		approveButtonURL: approveButtonURL.href,
		rejectButtonURL: rejectButtonURL.href
	});

	mailWrapper.sendToAdmin('Complaint reviewal required', html);
}



module.exports = router;