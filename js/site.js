"use strict";

// Add new movies to the list below:
// "movie-id": {
//   title: "MOVIE TITLE",
//   subheading: "Short tagline",
//   logo: "assets/movies/movie-folder/logo.png",
//   backdrop: "assets/movies/movie-folder/background.jpg",
//   video: "assets/movies/movie-folder/trailer.mp4",
//   release: "2027-12-25T00:00:00+08:00",
//   releaseLabel: "THIS DECEMBER 2027" (optional theater card label instead of countdown)
//   cinemaRelease: null (means no cinema release, or use a date string for a specific release date)
// }
// Optional cinema label instead of a countdown: cinemaReleaseLabel: "THIS JANUARY 2028"

const movies = {
  "angry-birds": {
    title: "THE ANGRY BIRDS MOVIE 3",
    subheading: "The flock is back",
    logo: "assets/movies/th-angry-birds-movie-3/logo-movie.png",
    backdrop: "assets/movies/th-angry-birds-movie-3/angry-birds-bg.jpg",
    video: "assets/movies/th-angry-birds-movie-3/abm3.mp4",
    release: "2026-12-23T16:00:00+08:00",
    cinemaRelease: "2027-01-01T00:00:00+08:00",
    cinemaReleaseLabel: "THIS JANUARY 2027"
  },
  "bluey": {
    title: "THE BLUEY MOVIE",
    subheading: "A new adventure awaits",
    logo: "assets/movies/the-bluey-movie/bluey-logo.png",
    backdrop: "assets/movies/the-bluey-movie/bluey-bg.jpg",
    video: "assets/movies/the-bluey-movie/tbm.mp4",
    release: "2027-08-06T00:00:00+08:00",
    cinemaRelease: null
  }
};

const page = document.querySelector("#movie-page");
const video = document.querySelector("#movie-video");
const source = document.querySelector("#movie-source");
const select = document.querySelector("#movie-select");
const backdrop = document.querySelector("#backdrop");
const movieLogo = document.querySelector("#movie-logo");
const movieTitle = document.querySelector("#movie-title");
const movieSubheading = document.querySelector("#movie-subheading");
const releaseDate = document.querySelector("#release-date");
const loadingState = document.querySelector("#loading-state");
const playHint = document.querySelector("#play-hint");
const countdowns = [
  { element: document.querySelector("#theater-countdown"), target: "release", display: "releaseLabel" },
  { element: document.querySelector("#cinema-countdown"), target: "cinemaRelease", display: "cinemaReleaseLabel" }
];

let activeMovie;
let countdownTimer;
let backgroundRequest = 0;
let movieChangeRequest = 0;
let movieTransitionTimer;
let movieEntranceTimer;

function formatReleaseDate(dateString) {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(new Date(dateString));
}

function makeCountdownUnits(element) {
  element.replaceChildren();
  for (const [label, key] of [["Days", "days"], ["Hours", "hours"], ["Minutes", "minutes"], ["Seconds", "seconds"]]) {
    const unit = document.createElement("div");
    unit.className = "time-unit";

    const value = document.createElement("span");
    value.className = "time-value";
    value.dataset.unit = key;
    value.textContent = "00";

    const unitLabel = document.createElement("span");
    unitLabel.className = "time-label";
    unitLabel.textContent = label;

    unit.append(value, unitLabel);
    element.append(unit);
  }
}

function updateCountdown(element, targetString, displayText) {
  if (displayText) {
    if (!element.classList.contains("is-featured")) {
      element.classList.remove("is-released", "is-tba");
      element.classList.add("is-featured");
      const label = document.createElement("span");
      label.className = "release-promo";
      label.textContent = displayText;
      element.replaceChildren(label);
    }
    return;
  }

  if (element.classList.contains("is-featured")) {
    makeCountdownUnits(element);
  }
  element.classList.remove("is-featured");
  const target = targetString ? new Date(targetString).getTime() : NaN;
  if (!Number.isFinite(target)) {
    if (!element.classList.contains("is-tba")) {
      element.classList.remove("is-released");
      element.classList.add("is-tba");
      const value = document.createElement("span");
      value.className = "tba-value";
      value.textContent = "TBA";
      const label = document.createElement("span");
      label.className = "tba-label";
      label.textContent = "To be announced";
      element.replaceChildren(value, label);
    }
    return;
  }

  if (element.classList.contains("is-tba") || element.classList.contains("is-released")) {
    makeCountdownUnits(element);
  }
  element.classList.remove("is-tba");
  const remaining = Math.max(0, target - Date.now());
  const totalSeconds = Math.floor(remaining / 1000);
  const values = {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60
  };

  if (remaining === 0) {
    element.classList.add("is-released");
    element.textContent = "NOW SCREENING";
    return;
  }

  element.classList.remove("is-released");
  for (const [key, value] of Object.entries(values)) {
    const number = element.querySelector(`[data-unit="${key}"]`);
    const nextValue = key === "days" ? String(value) : String(value).padStart(2, "0");
    if (number.textContent !== nextValue) {
      number.textContent = nextValue;
      number.classList.add("is-ticking");
      window.setTimeout(() => number.classList.remove("is-ticking"), 260);
    }
  }
}

function startCountdowns(movie) {
  if (countdownTimer) {
    window.clearInterval(countdownTimer);
  }

  for (const countdown of countdowns) {
    updateCountdown(countdown.element, movie[countdown.target], movie[countdown.display]);
  }
  countdownTimer = window.setInterval(() => {
    for (const countdown of countdowns) {
      updateCountdown(countdown.element, movie[countdown.target], movie[countdown.display]);
    }
  }, 1000);
}

function loadBackdropImage(url) {
  const requestId = ++backgroundRequest;
  page.classList.add("is-changing-backdrop");
  const image = new Image();
  image.onload = () => {
    if (requestId !== backgroundRequest) return;
    backdrop.style.backgroundImage = `url("${url}")`;
    page.classList.add("is-ready");
    page.classList.remove("is-changing-backdrop");
  };
  image.onerror = () => {
    if (requestId !== backgroundRequest) return;
    loadingState.textContent = "Unable to load the movie artwork";
    page.classList.add("is-ready");
    page.classList.remove("is-changing-backdrop");
    console.error(`Unable to load movie backdrop: ${url}`);
  };
  image.src = url;
}

function loadMovie(movieId, animate = false) {
  const movie = movies[movieId];
  if (!movie) {
    console.error(`Unknown movie selected: ${movieId}`);
    return;
  }

  const requestId = ++movieChangeRequest;
  window.clearTimeout(movieTransitionTimer);
  window.clearTimeout(movieEntranceTimer);
  page.classList.remove("is-film-entering", "is-film-exiting");

  const showMovie = () => {
    if (requestId !== movieChangeRequest) return;
    page.classList.remove("is-film-exiting");
    if (animate) {
      page.classList.add("is-film-entering");
      movieEntranceTimer = window.setTimeout(() => {
        if (requestId === movieChangeRequest) {
          page.classList.remove("is-film-entering");
        }
      }, 850);
    }

    activeMovie = movie;
    document.title = movie.title;
    movieTitle.textContent = movie.title;
    movieSubheading.textContent = movie.subheading;
    movieLogo.src = movie.logo;
    movieLogo.alt = `${movie.title} logo`;
    releaseDate.textContent = ` ${formatReleaseDate(movie.release)}`;
    loadBackdropImage(movie.backdrop);
    startCountdowns(movie);

    page.classList.remove("video-ready");
    loadingState.textContent = "Preparing the picture";
    playHint.textContent = "";
    video.pause();
    source.src = movie.video;
    video.load();
    const playAttempt = video.play();
    if (playAttempt && typeof playAttempt.catch === "function") {
      playAttempt.catch(() => {
        if (activeMovie !== movie) return;
        playHint.textContent = "Tap or click anywhere to start the trailer with sound";
      });
    }
  };

  if (animate) {
    page.classList.add("is-film-exiting");
    movieTransitionTimer = window.setTimeout(showMovie, 260);
    return;
  }

  showMovie();
}

video.addEventListener("loadeddata", () => {
  page.classList.add("video-ready");
});

video.addEventListener("error", () => {
  page.classList.remove("video-ready");
  playHint.textContent = "The trailer could not be loaded";
  console.error(`Unable to load movie trailer: ${source.src}`);
});

select.addEventListener("change", (event) => {
  loadMovie(event.currentTarget.value, true);
});

document.addEventListener("pointerdown", () => {
  if (video.paused && activeMovie) {
    video.play().then(() => {
      playHint.textContent = "";
    }).catch((error) => {
      console.error("Unable to start the movie trailer:", error);
    });
  }
}, { once: true });

makeCountdownUnits(countdowns[0].element);
makeCountdownUnits(countdowns[1].element);
loadMovie(select.value);