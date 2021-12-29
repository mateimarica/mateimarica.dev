const express = require('express'),
      router = express.Router(),
      path = require('path');

router.get('/', (req, res) => {
	res.set({
		'Content-Type': 'application/pdf',
		'Content-Disposition': `inline; filename="${process.env.RESUME_FILENAME}"`
	});
	res.status(200).sendFile(path.join(__dirname, '../documents/', process.env.RESUME_FILENAME));
});

module.exports = router;