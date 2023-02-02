const express = require('express'),
      router = express.Router(),
      path = require('path');

router.get('/', (req, res) => {
	res.status(200).sendFile(path.join(__dirname, '../frontend_build/main_components/WIP.html'));
});

module.exports = router;