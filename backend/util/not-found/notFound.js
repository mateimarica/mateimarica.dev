'use strict';

const path = require('path');

module.exports = (req, res, next) => {
	if (req.method === 'GET') {
		return res.status(404).sendFile(path.join(__dirname, '../../frontend_build/main_components/404.html'));
	}
	
	res.sendStatus(404);
};