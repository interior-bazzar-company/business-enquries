/* Self-check for the input validators in js/script.js.
   Run: node test-validators.js   (no framework, no deps) */
var fs = require("fs"),
  a = require("assert");

var src = fs.readFileSync("js/script.js", "utf8");
var start = src.indexOf("/* -------- input sanity --------");
var end = src.indexOf("/* -------- validation + transitions -------- */");
a.ok(start > -1 && end > start, "validator block not found in js/script.js");
eval(src.slice(start, end));

function pass(fn, label, list) {
  list.forEach(function (v) {
    a.ok(fn(v), label + " should ACCEPT: " + JSON.stringify(v));
  });
}
function fail(fn, label, list) {
  list.forEach(function (v) {
    a.ok(!fn(v), label + " should REJECT: " + JSON.stringify(v));
  });
}

pass(phoneOk, "phone", [
  "9876543211", "6123456780", "8000000001",
  "+91 98765 43211", "09876543211", "98765 43211",
]);
fail(phoneOk, "phone", [
  "1234", "1234567890", "5876543211", "987654321", "98765432110",
  "9999999999", "9876543210", "6789012345", "abcdefghij", "",
]);

pass(nameOk, "name", [
  "Vishal", "Vishal Shakya", "R. Sharma", "O'Brien", "Rene Dsouza", "Jo Ann",
]);
fail(nameOk, "name", [
  "asdf", "qwerty", "zxcv", "hjkl", "sdfgh", "aaaa",
  "...", "1234", "V", "x@y", "Vishal123", "  ", "",
]);

pass(cityOk, "city", [
  "Delhi", "New Delhi", "Bengaluru", "Thiruvananthapuram", "Navi-Mumbai", "Indore",
]);
fail(cityOk, "city", [
  "asdf", "qwe", "123", "Delhi1", "xyz", "mmm", "zxcvbnm", "", "  ",
]);

pass(pinOk, "pincode", ["110001", "452001", "560034", "700016"]);
fail(pinOk, "pincode", [
  "012345", "123456", "111111", "999999", "654321", "1234", "1234567", "abc123", "",
]);

console.log("all validator checks passed");
