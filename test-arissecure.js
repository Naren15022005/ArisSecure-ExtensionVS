// test-arissecure.js - Archivo de prueba para ArisSecure

const dbPassword = "admin123";
const apiKey = "sk-1234567890abcdef";

function getUser(userId) {
  const query = "SELECT * FROM users WHERE id = " + userId;
  return db.execute(query);
}

function displayComment(userComment) {
  el.innerHTML = userComment;
}

function runUserCode(code) {
  eval(code);
}

try {
  dangerousFunction();
} catch (e) {}

console.log("debug data");

// TODO: fix this

const unusedVar = 42;