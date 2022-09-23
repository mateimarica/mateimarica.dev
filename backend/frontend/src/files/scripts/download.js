const bodyStyle = document.body.style;

async function spinBackground() {
	while (true) {
		for (let degrees = 0; degrees <= 360; degrees += 0.4) {
			await sleep(10);
			bodyStyle.background = 'linear-gradient(' + degrees + 'deg, var(--mainBackgroundColor), var(--secondaryBackgroundColor))';
		}
	}
}

spinBackground();

function sleep(milli) {
	return new Promise(resolve => {
		setTimeout(() => { resolve() }, milli);
	});
}

/** Unused */
function randomInt(floorInt, ceilInt) {
	return floorInt + Math.floor((Math.random() * (ceilInt - floorInt + 1)));
}