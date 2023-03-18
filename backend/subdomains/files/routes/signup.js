const express = require('express'),
      router = express.Router(),
      authManager = require('../authManager'),
      files = require('../files'),
      bcrypt = require('bcrypt'),
      { nanoid } = require('nanoid'),
      path = require('path'),
      rateLimit = require('express-rate-limit'),
      escape = require('escape-html'),
      mailWrapper = require('mail-wrapper'),
      emailValidator = require('email-validator'),
      sizeFormatter = require('size-formatter');

require('@marko/compiler/register');

const pool = files.pool;

const SIGNUP_RATE_LIMITER = rateLimit({
	windowMs: process.env.FILES_SIGNUP_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.FILES_SIGNUP_LIMITER_MAX_REQUESTS,
	message: "You've already requested an account recently.",
	headers: false,
	skipFailedRequests: true
});

const DEFAULT_USER_SPACE_BYTES = process.env.FILE_DEFAULT_USER_SPACE_GBS * 1000000000;

const accountRequestEmailTemplate = require(path.join(files.COMPONENTS_DIR, 'email', 'account_request_review_email')).default;
router.post('/', SIGNUP_RATE_LIMITER, (req, res) => {

	if (!req.body) return res.sendStatus(400);

	const username = req.body.username,
	      password = req.body.password;

	if (!username || !password || typeof username !== 'string' || typeof password !== 'string')
		return res.sendStatus(400);

	if (username.length < 2 || username.length > 15)
		return res.status(400).send('Username length must be between 2 and 15');

	if (/^[a-z0-9]+$/i.test(username) === false)
		return res.status(400).send('Username must be alphanumeric');

	if (password.length < 6 || username.length > 200)
		return res.status(400).send('Password length must be between 6 and 200');

	const email = req.body.email || null; // set email to null instead of undefined
	if (email && !emailValidator.validate(email)) 
		return res.status(400).send('That email is invalid');

	const message = req.body.message || null; // set email to null instead of undefined
	if (message && message.length > 200)
		return res.status(400).send('Message cannot exceed 200 characters');

	bcrypt.hash(password, 10, (err, hash) => {
		if (err) {
			console.log(err);
			return res.sendStatus(500);
		}

		const tempApprovalId = nanoid(100);

		const sql = `INSERT INTO users (username, password, role, active, space, email, message, tempApprovalId) ` +
		`VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		params = [username, hash, authManager.ROLE.USER, false, DEFAULT_USER_SPACE_BYTES, email, message, tempApprovalId];

		pool.execute(sql, params, (err, results) => {
			if (err) {
				if (err.code === 'ER_DUP_ENTRY') {
					return res.status(409).send('That username is already in use');
				}
				console.log(err);
				return res.sendStatus(502);
			}

			if (results && results.affectedRows === 1) {
				res.sendStatus(201);

				const baseURL = `${req.protocol}://${req.get('host') + '/signup/review'}`;

				const approvalURL = new URL(baseURL);
				approvalURL.searchParams.append('approval_id', tempApprovalId);
				approvalURL.searchParams.append('approved', 1);

				const denialURL = new URL(baseURL);
				denialURL.searchParams.append('approval_id', tempApprovalId);
				denialURL.searchParams.append('approved', 0);

				const html = accountRequestEmailTemplate.renderToString({
					username: escape(username),
					email: escape(email),
					message: escape(message),
					approvalURL: approvalURL.href,
					denialURL: denialURL.href
				});

				mailWrapper.sendToAdmin('Files Account Request', html);
				return;
			} else {
				console.log('Unable to sign user up.')
				return res.sendStatus(500);
			}
		});
	});
});

const SIGNUP_REVIEWAL_RATE_LIMITER = rateLimit({
	windowMs: process.env.FILES_SIGNUP_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.FILES_SIGNUP_LIMITER_MAX_REQUESTS,
	message: "What are you doing?",
	headers: false,
	skipSuccessfulRequests: true
});

const approvalConfirmationPageTemplate = require(path.join(files.COMPONENTS_DIR, '../main_components/approvalConfirmation')).default,
      accountApprovalEmailTemplate = require(path.join(files.COMPONENTS_DIR, 'email', 'account_request_approval_email')).default,
      accountDenialEmailTemplate = require(path.join(files.COMPONENTS_DIR, 'email', 'account_request_denial_email')).default;
router.get('/review', SIGNUP_REVIEWAL_RATE_LIMITER, (req, res) => {
	if (!req.query) return res.sendStatus(400);

	const approvalId = req.query.approval_id,
	      approved = req.query.approved;

	if (!approvalId || !approved || (approved !== '0' && approved !== '1')) {
		return res.sendStatus(400);
	}

	const sql = `SELECT username, email, tempApprovalId, space FROM users WHERE tempApprovalId=? AND active=FALSE`;
	const params = [approvalId];

	pool.execute(sql, params, (err, results) => {
		if (err) {
			console.log(err);
			return res.sendStatus(500);
		}

		if (results.length === 0) return res.sendStatus(404);

		const approvedBool = (approved === '1'); // convert string to boolean

		if (approvedBool) {
			var sql2 = `UPDATE users SET active=?, tempApprovalId=NULL WHERE tempApprovalId=? AND active=FALSE`; // verbose to be safe
			var params2 = [approvedBool, approvalId];
		} else {
			var sql2 = `DELETE FROM users WHERE tempApprovalId=? AND active=FALSE`; // verbose to be safe
			var params2 = [approvalId];
		}
	
		pool.execute(sql2, params2, (err2, results2) => {
			if (err2) {
				console.log(err2);
				return res.sendStatus(500);
			} else if (results2.affectedRows === 0) {
				return res.sendStatus(404);
			}
	
			let header = '\u2714'; // Check-mark symbol
			let message = (req.query.approved === '1' ? 'Approval' : 'Rejection') + " successful";

			const approvalConfirmationHTML = approvalConfirmationPageTemplate.renderToString({
				header: header,
				message: message
			});

			res.set('Content-Type', 'text/html');
			res.status(200).send(approvalConfirmationHTML);
	
			if (approvedBool) {
				var subject = 'Welcome to Files!';
				var emailContents = accountApprovalEmailTemplate.renderToString({
					username: escape(results[0].username),
					space: sizeFormatter.getFormattedSize(results[0].space),
					domainURL: `${req.protocol}://${req.get('host')}`
				});
			} else {
				var subject = 'Account Request Denied';
				var emailContents = accountDenialEmailTemplate.renderToString({
					username: escape(results[0].username),
					domain: req.get('host')
				});
			}

			mailWrapper.send(results[0].email, subject, emailContents);
		});
	});
});

module.exports = router;