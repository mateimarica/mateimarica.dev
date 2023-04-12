'use strict';

const dynamicTextArea = async function() {
	let y = window.scrollY; // record last scroll position
	this.style.height = "";
	this.style.height = this.scrollHeight + "px";
	window.scrollTo(0, y); // jump to last scroll position
};

/** A simple sleep function. Obviously, only call this from async functions. */
function sleep(milli) {
	return new Promise(resolve => {
		setTimeout(() => { resolve() }, milli);
	});
}

function randomInt(floorNum, ceilNum) {
	return floorNum + Math.floor((Math.random() * (ceilNum - floorNum + 1)));
}

const MILLI_PER_MIN = 60000,
      MINS_PER_HOUR = 60,
      MINS_PER_DAY = 1440,
      MINS_PER_WEEK = 10080,
      MINS_PER_MONTH = 43200,
      MINS_PER_YEAR = 525600;

/** Example: Converts "2020-11-15T23:11:01.000Z" to "a year ago" */
function getRelativeTime(oldDate, currentDate) {

	const MINUTES_PASSED = Math.floor((Math.abs(currentDate - oldDate)) / MILLI_PER_MIN); 

	if (MINUTES_PASSED === 0)
		return 'just now';

	// If less than an hour has passed, print minutes
	if(MINUTES_PASSED < MINS_PER_HOUR) {
		return MINUTES_PASSED + ((MINUTES_PASSED === 1) ? ' minute ago' : ' minutes ago');
	}

	// If less than an day has passed, print hours
	if(MINUTES_PASSED < MINS_PER_DAY) {
		let hoursPassed = Math.floor(MINUTES_PASSED / MINS_PER_HOUR);
		return hoursPassed + ((hoursPassed === 1) ? ' hour ago' : ' hours ago');
	}

	// If less than an week has passed, print days
	if(MINUTES_PASSED < MINS_PER_WEEK) {
		let daysPassed = Math.floor(MINUTES_PASSED / MINS_PER_DAY);
		return daysPassed + (daysPassed === 1 ? ' day ago' : ' days ago');
	}

	// If less than an month has passed, print weeks
	if(MINUTES_PASSED < MINS_PER_MONTH) {
		let weeksPassed = Math.floor(MINUTES_PASSED / MINS_PER_WEEK);
		return weeksPassed + (weeksPassed === 1 ? ' week ago' : ' weeks ago');
	}

	// If less than an year has passed, print months
	if(MINUTES_PASSED < MINS_PER_YEAR) {
		let monthsPassed = Math.floor(MINUTES_PASSED / MINS_PER_MONTH);
		return monthsPassed + (monthsPassed === 1 ? ' month ago' : ' months ago');
	}
}

function getUtcOffsetTime(date) {
	const utcOffset = date.getTimezoneOffset();
	const utcOffsetHrs = Math.floor(utcOffset / 60);
	const utcOffsetMins = utcOffset % 60;
	return `${date.toLocaleString()} UTC${utcOffset<0 ? '+' : '-'}${utcOffsetHrs}${utcOffsetMins>0 ? ':'+utcOffsetMins : ''}`;
}

const KILOBYTE = 1000,
      MEGABYTE = 1000000,
      GIGABYTE = 1000000000;

/** The parseFloat() removes trailing zeroes (eg: 1.0 -> 1) */
function getFormattedSize(bytes) {
	if(bytes < KILOBYTE) {
		return bytes + ' B';
	}

	if(bytes < MEGABYTE) {
		return parseFloat((bytes / KILOBYTE).toFixed(1)) + ' KB';
	}

	if(bytes < GIGABYTE) {
		return parseFloat((bytes / MEGABYTE).toFixed(1)) + ' MB';
	}

	return parseFloat((bytes / GIGABYTE).toFixed(1)) + ' GB';
}

export {
	dynamicTextArea,
	sleep,
	randomInt,
	getRelativeTime,
	getUtcOffsetTime,
	getFormattedSize
};