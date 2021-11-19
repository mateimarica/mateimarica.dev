var style = getComputedStyle(document.body)
let mainBackgroundColor = style.getPropertyValue('--mainBackgroundColor');
let sectionContainerColor = style.getPropertyValue('--sectionContainerColor');

let UNBTooltip = document.querySelector("#UNBtooltip");
let tooltipPopup = UNBTooltip.querySelector("span");
UNBTooltip.addEventListener('mouseover', (e) => {
	if (tooltipPopup.getBoundingClientRect().right > window.innerWidth) {
		tooltipPopup.style.whiteSpace = "normal";
		tooltipPopup.style.top = "-1em";
		tooltipPopup.style.left = "130%";
		//tooltipPopup.style.left = `${window.innerWidth - tooltipPopup.getBoundingClientRect().right}px`;
	}

	// Set fake inverted styling
	let bodyContainer = document.querySelector("#bodyContainer");
	let distanceFromTooltipToContainerEdge = Math.floor(bodyContainer.getBoundingClientRect().right - tooltipPopup.getBoundingClientRect().left);
	tooltipPopup.style.background = `linear-gradient(90deg, ${mainBackgroundColor} ${distanceFromTooltipToContainerEdge}px, ${sectionContainerColor} ${distanceFromTooltipToContainerEdge}px)`;
});

UNBTooltip.addEventListener('mouseleave', (e) => {
	tooltipPopup.style.whiteSpace = "nowrap";
	tooltipPopup.style.top = "0";
	tooltipPopup.style.left = "130%";
});

function handleComplaintFormSubmission() {
	let complaintForm = document.querySelector("#complaintForm");
	let complaintField = complaintForm.querySelector("#complaintField");
	let complaint = complaintField.value;

	// If there"s nothing in the complaintField, alert the user
	// Or, if there are only spaces in the complaint. trim() would make a space-only string into "", which is falsy
	if (complaint === "" || !complaint.trim()) {
		let errorMessage = document.querySelector("#errorMessage");
		errorMessage.style.display = "block"; // Make errorBox appear
		errorMessage.innerHTML = "\u26A0 Can't leave the complaint field blank!";
		complaintField.style.border = "2px solid darkred"; // Highlight the empty complaintField
		window.scrollBy(0, 100); // Scroll 100px down so the submit button is still visible
		return;
	}

}

