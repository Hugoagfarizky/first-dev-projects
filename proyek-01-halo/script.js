const button = document.querySelector("#greet-button");
const greeting = document.querySelector("#greeting");
const year = document.querySelector("#year");

const messages = [
  "Hello! Welcome to my corner of the web.",
  "Nice to meet you — thanks for clicking.",
  "Still learning, still building. One commit at a time.",
];

let nextMessage = 0;

if (button && greeting) {
  button.addEventListener("click", () => {
    greeting.textContent = messages[nextMessage % messages.length];
    greeting.classList.remove("is-visible");
    void greeting.offsetWidth; // restart the animation
    greeting.classList.add("is-visible");
    nextMessage += 1;
  });
}

if (year) {
  year.textContent = String(new Date().getFullYear());
}
