const crypto = require('crypto');

let sessions = [];

function authInspector(req, res, next) {
	if (!isSessionValid(req.get('Authorization'))) {
		res.set('WWW-Authenticate', 'xBasic realm="files"');
		return res.sendStatus(401);
	}

	console.log(req.files);
	
	next();
}

/** Returns the authorization string */
function createNewSession() {
	let newSession = {
		creationDate: new Date(),
		authorization: crypto.randomBytes(16).toString('base64')
	}

	sessions.push(newSession);

	return newSession.authorization;
}

const MILLI_PER_15_MINS = 900000;

function isSessionValid(authorization) {
	if (!authorization) return false

	let currentDate = new Date();
	for (let i = 0; i < sessions.length; i++) {
		if ((currentDate - sessions[i].creationDate) < MILLI_PER_15_MINS) {
			if(sessions[i].authorization === authorization) return true;
		} else {
			sessions.splice(i, 1); // removes 1 element starting at index i
			if(sessions[i].authorization === authorization) return false;
		}
	}
	
	return false;
}

module.exports = { authInspector, createNewSession }