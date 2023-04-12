'use strict';

const nodemailer = require('nodemailer');

const CONFIG = {
	host: process.env.EMAIL_HOST,
	port: process.env.EMAIL_PORT,
	senderAddress: process.env.EMAIL_SENDER_ADDRESS,
	senderName: process.env.EMAIL_SENDER_NAME,
	smtpUsername: process.env.EMAIL_SMTP_USERNAME,
	smtpPassword: process.env.EMAIL_SMTP_PASSWORD,
	adminRecipient: process.env.EMAIL_ADMIN_RECIPIENT
};

// Check that every value in config is truthy
if (!Object.values(CONFIG).every(v => !!v)) {
	throw Error('Not all email environment vars set.');
}

const TRANSPORTER = nodemailer.createTransport({
	host: CONFIG.host,
	port: CONFIG.port,
	secure: false,
	requireTLS: true, // use TLS
	auth: {
		user: CONFIG.smtpUsername,
		pass: CONFIG.smtpPassword
	}
});

function sendToAdmin(subject, contents) {
	send(CONFIG.adminRecipient, subject, contents);
}

function send(recipient, subject, contents, callback=null) {
	if (!recipient || !subject || !contents) {
		if (callback) callback('Need all three to send email: recipient, subject, contents.', null);
		return false;
	}

	const email = {
		from: {
			name: CONFIG.senderName,
			address: CONFIG.senderAddress
		},
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