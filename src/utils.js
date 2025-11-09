function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function valueMultiples(value) {
  return value > 1 ? "s" : "";
}

module.exports = { wait, valueMultiples };
