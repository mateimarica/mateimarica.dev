/** Converts a date into a string with the format "dd-mm-yyyy at hh:mm GMTtz"
 * @param  {Date} date The first number
 * @return {String} A formatted string representation of the date.
 */
 function formatDate(date) {
    let d = date.getDate();
    let m = date.getMonth() + 1;
    let y = date.getFullYear();
	let h = date.getHours();
	let min = date.getMinutes();
	let tz = 'GMT' + -(date.getTimezoneOffset() / 60);

    return (d<10 ? '0'+d : d) + '-' + (m<10 ? '0'+m : m) + '-' + y + ' at ' + (h<10 ? '0'+h : h) + ':' + (min<10 ? '0'+min : min) + ' ' + tz;
}

module.exports = { formatDate };