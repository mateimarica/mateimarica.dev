'use strict';

const password = process.env.SEARCHICTON_PASSWORD;

function authInspector(req, res, next) {
	if (req.get('Authorization') !== password) {
		res.set('WWW-Authenticate', 'xBasic realm="searchicton"');
		return res.status(401).send('Incorrect password');
	}

	next();
}

module.exports = authInspector;