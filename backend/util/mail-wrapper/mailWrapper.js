'use strict';

const nodemailer = require('nodemailer');

const EMAIL_SERVICE = process.env.EMAIL_SERVICE,
      EMAIL_USERNAME = process.env.EMAIL_USERNAME,
      EMAIL_PASSWORD = process.env.EMAIL_PASSWORD,
      ADMIN_RECIPIENT = process.env.EMAIL_RECIPIENT;

if (!EMAIL_SERVICE || !EMAIL_USERNAME || !EMAIL_USERNAME || !ADMIN_RECIPIENT) {
	console.error('Not all email environment vars set. Emails likely will not work.');
}

const TRANSPORTER = nodemailer.createTransport({
	service: EMAIL_SERVICE,
	port: 587,
	secure: true, // use TLS
	auth: {
		user: EMAIL_USERNAME,
		pass: EMAIL_PASSWORD
	}
});

function sendToAdmin(subject, contents) {
	send(ADMIN_RECIPIENT, subject, contents);
}

function send(recipient, subject, contents, callback=null) {
	if (!recipient || !subject || !contents || !EMAIL_SERVICE || !EMAIL_USERNAME || !EMAIL_USERNAME) {
		return false;
	}

	const email = {
		from: EMAIL_USERNAME,
		to: recipient,
		subject: subject,
		html: contents
	};

	TRANSPORTER.sendMail(email, (err, info) => {
		if (callback) callback(err, info);
		if (err) console.error(err);
	});
}

function checkConnection() {
	TRANSPORTER.verify((error, success) => {
		if (error) {
			console.error(error);
		} else {
			console.log('Mail client authenticated successfully');
		}
	});
}

module.exports = { sendToAdmin, send, checkConnection };