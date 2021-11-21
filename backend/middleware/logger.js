const moment = require('moment');

const logger = (req, res, next) => {
	console.log(`[${moment().format()}] Incoming request: ${req.protocol}://${req.get('host') + req.url}`);
	next();
};

module.exports = logger;