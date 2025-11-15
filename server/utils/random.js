// server/utils/random.js

// Sinh số ngẫu nhiên theo phân phối chuẩn (Box-Muller)
function randomNormal(mean = 0, stdDev = 1) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + stdDev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Sinh số ngẫu nhiên trong khoảng [min, max]
function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

module.exports = { randomNormal, randomBetween };
