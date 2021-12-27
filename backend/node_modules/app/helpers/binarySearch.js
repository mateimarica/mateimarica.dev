function isValueInArray(value, arr) {
	let startIndex  = 0,
		stopIndex   = arr.length - 1,
		middleIndex = Math.floor((stopIndex + startIndex) / 2);

	while(arr[middleIndex] != value && startIndex < stopIndex) {

		// Adjust search area
		if (value < arr[middleIndex]) {
			stopIndex = middleIndex - 1;
		} else if (value > arr[middleIndex]) {
			startIndex = middleIndex + 1;
		}

		// Recalculate middle
		middleIndex = Math.floor((stopIndex + startIndex) / 2);
	}

	// Return true or false
	return (arr[middleIndex] === value);
}

module.exports = isValueInArray;