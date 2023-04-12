'use strict';

const express = require('express'),
      router = express.Router(),
      { authInspector, ROLE } = require('../authManager'),
      { createPoll } = require('../pollManager.js');

router.post('/', authInspector(ROLE.USER), (req, res) => createPoll(req, res));

module.exports = router;