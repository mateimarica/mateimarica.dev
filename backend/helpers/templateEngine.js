const fs = require('fs');

/** Fills an HTML file with the given key-value pairs.
 * Replaces every matched key in the HTML to the value. Eg: ${name} -> Matei
 * @param  {String} templatePath The directory path to the HTML file
 * @param  {Object} keyValuePairs The key-value pairs that correlate with the ${keys} in the HTML. 
 * Every ${key} in the HTML is replaced with the corresponding on in this object.  
 * @return {String} The filled-in HTML file as a string.
 */
function fillHTML(templatePath, keyValuePairs) {
	const html = fs.readFileSync(templatePath,	{encoding:'utf8', flag:'r'});

	// match = the regex match. Eg: "${complaint}"
	// capture = the captured string inside the regex match. Eg: "complaint"
	return html.replace(/\${([^}]*)}/g, (match, capture) => {
		return keyValuePairs[capture];
	});

}

module.exports = { fillHTML };