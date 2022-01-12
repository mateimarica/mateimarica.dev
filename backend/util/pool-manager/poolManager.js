const mysql = require('mysql2');

let pools = [];

function getPool(databaseName) {
	for (let i = 0; i < pools.length; i++) {
		if (pools[i].databaseName === databaseName) {
			return pools[i].pool; // Return existing pool
		}	
	}
	return createPool(databaseName); // Create new pool
}

function createPool(databaseName) {
	let pool  = mysql.createPool({
		user: process.env.DB_USERNAME,
		password: process.env.DB_PASSWORD,
		database: databaseName,
		multipleStatements: process.env.DB_MULT_STATEMENTS,
		connectionLimit: process.env.DB_CONNECTION_LIMIT,
		waitForConnections: process.env.DB_WAIT_FOR_CONNECTIONS,
		queueLimit: process.env.DB_QUEUE_LIMIT,
		connectTimeout: process.env.DB_CONNECT_TIMOUT_MILLI
	});


	let poolWrapper = {
		pool: pool,
		databaseName: databaseName
	}

	pools.push(poolWrapper);

	return pool;
}

module.exports = { getPool };