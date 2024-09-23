'use strict';

const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);

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

let navigationBar = $('#navigationBar');
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

const SLIDE_DURATION = 6000,
      TRANSITION_DURATION = 1400,
      QUICK_TRANSITION_DURATION = 450;

const slides = $$('.slide'),
      pauseIcon = $('#pauseIcon');

let pauseSlides = false,
    currentSlide = 0, // Used to save the index of current slide when slideslow is paused.
    isRunning = false; // Whether the doSlideshow() function is running. Used to ensure only 1 instance of the method runs at a time.

// Set event listeners to stop/start the slideshow
for(let i = 0; i < slides.length; i++) {
	slides[i].addEventListener('mouseenter', async () => {
		pauseSlides = true;
		pauseIcon.classList.add('fadeInQuick');
		await sleep(QUICK_TRANSITION_DURATION);
		pauseIcon.style.opacity = '1';
		pauseIcon.classList.remove('fadeInQuick');
	});
	slides[i].addEventListener('mouseleave', async () => {
		pauseSlides = false;
		doSlideshow(currentSlide);
		pauseIcon.classList.add('fadeOutQuick');
		await sleep(QUICK_TRANSITION_DURATION);
		pauseIcon.style.opacity = '0';
		pauseIcon.classList.remove('fadeOutQuick');
	});
}

doSlideshow(getRandomInt(0, slides.length - 1));

async function doSlideshow(startIndex) {
	if (!isRunning) {
		isRunning = true;
		slides[startIndex].style.opacity = '1'; // Set visible
		let next;
		while (true) {
			for (let i = startIndex; i < slides.length; i++) {
				startIndex = 0;

				next = (i+1 === slides.length ? 0 : i+1);

				if (pauseSlides) {
					currentSlide = i;
					isRunning = false;
					return;
				}

				await sleep(SLIDE_DURATION);

				if (pauseSlides) {
					currentSlide = i;
					isRunning = false;
					return;
				}

				slides[i].classList.add('fadeOut');
				slides[next].classList.add('fadeIn');

				await sleep(TRANSITION_DURATION); // transition, time just under transition duration to prevent flashing

				slides[i].style.opacity = '0';
				slides[next].style.opacity = '1';

				slides[i].classList.remove('fadeOut');
				slides[next].classList.remove('fadeIn');
			}
		}
	}
}

/** A simple sleep function. Obviously, only call this from async functions. */
function sleep(milli) {
	return new Promise(resolve => {
		setTimeout(() => { resolve() }, milli);
	});
}

function getRandomInt(min, max) {
	return min + Math.floor(Math.random() * (max + 1));
}