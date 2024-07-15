'use strict';

const express = require('express'),
      router = express.Router(),
      path = require('path');

router.use(express.static(path.join(__dirname, '../../frontend_build/jquestrade')));

module.exports = router;