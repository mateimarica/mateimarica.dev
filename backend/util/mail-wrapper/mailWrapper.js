const nodemailer = require('nodemailer');

const EMAIL_SERVICE = process.env.EMAIL_SERVICE,
      EMAIL_USERNAME = process.env.EMAIL_USERNAME,
      EMAIL_PASSWORD = process.env.EMAIL_PASSWORD,
      ADMIN_RECIPIENT = process.env.EMAIL_RECIPIENT;

const TRANSPORTER = nodemailer.createTransport({
	service: EMAIL_SERVICE,
	port: 587,
	secure: true, // use TLS
	auth: {
		user: EMAIL_USERNAME,
		pass: EMAIL_PASSWORD
	}
});

// Pass in null for recipient to use ADMIN_RECIPIENT
function send(recipient, subject, contents) {
	recipient = recipient || ADMIN_RECIPIENT;

	if (!EMAIL_SERVICE || !EMAIL_USERNAME || !EMAIL_USERNAME || !subject || !contents) {
		console.error(`Complaint couldn't be sent for approval. Info: service=${!!EMAIL_SERVICE} email=${!!EMAIL_USERNAME} password=${!!EMAIL_PASSWORD} recipient=${!!recipient} subject=${!!subject} contents=${!!contents}`);
		return;
	}

	const email = {
		from: EMAIL_USERNAME,
		to: recipient,
		subject: subject,
		html: contents
	};

	TRANSPORTER.sendMail(email, (err, info) => {
		if (err) {
			console.error(err);
		} else {
			console.log('Email sent: ' + info.response);
		}
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

module.exports = { send, checkConnection };