function handleInvalidJSON(err, req, res, next) {
	if (err instanceof SyntaxError) 
		return res.status(400).send('Invalid JSON');

	console.error(err);
	res.sendStatus(500);
}

module.exports = handleInvalidJSON;