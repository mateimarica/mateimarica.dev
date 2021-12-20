let style = getComputedStyle(document.body);

let lastKnownScrollPosition = 0;
let ticking = false;
document.addEventListener('scroll', (e) => {
	lastKnownScrollPosition = window.scrollY;

	if (!ticking) {
		ticking = true;

		window.requestAnimationFrame(() => {
			setNavbarTransparency(lastKnownScrollPosition);
			ticking = false;
		});
	}
});

let navigationBar = document.querySelector('#navigationBar');
function setNavbarTransparency(scrollPos) {
	if(scrollPos > 0) {
		navigationBar.className = 'navigationBarOnScroll';
	} else {
		navigationBar.className = 'navigationBarOriginalPosition';
	}
}

function isElementInViewport(element) {
	let rect = element.getBoundingClientRect();
	return rect.bottom > 0 &&
	       rect.right > 0 &&
	       rect.left < (window.innerWidth || document.documentElement.clientWidth) &&
		   rect.top< (window.innerHeight || document.documentElement.clientHeight);
}