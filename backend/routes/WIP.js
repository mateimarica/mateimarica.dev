const express = require('express'),
      router = express.Router(),
	  path = require('path');

router.get('/', (request, response) => {
	response.status(200).sendFile(path.join(__dirname, '../components/WIP.html'));
});

module.exports = router;