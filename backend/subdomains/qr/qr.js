const express = require('express'),
      router = express.Router(),
      path = require('path'),
	  rateLimit = require("express-rate-limit");	

const STATIC_PAGE_RATE_LIMITER = rateLimit({
		windowMs: process.env.GENERAL_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
		max: process.env.STATIC_LIMITER_MAX_REQUESTS * process.env.NUM_OF_STATIC_FILES, // Max num of requests per time window * the rough num of static files
		message: "Too many requests, try again later.",
		headers: false
});
	
const API_RATE_LIMITER = rateLimit({
	windowMs: process.env.GENERAL_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.QR_API_LIMITER_MAX_REQUESTS,
	message: "Too many requests, try again later.",
	headers: false
});

// router.use('/api/complaints', API_RATE_LIMITER, require('./routes/api/complaints'));

router.use(express.json({limit: process.env.REQUEST_MAX_BODY_SIZE}));
router.use(express.urlencoded({limit: process.env.REQUEST_MAX_BODY_SIZE, extended: true}));

//router.use('/', STATIC_PAGE_RATE_LIMITER);
router.use(express.static(path.join(__dirname, '../../../frontend/qrequest')));
router.use('/api/users', require('./routes/api/users').router);
router.use('/api/questions', require('./routes/api/questions'));

router.get('*', (req, res) => {
	res.sendStatus(404);
});

module.exports = router;