const bufferKey = (key) => Buffer.from(key, "utf-8").toString("base64");
const decodeKey = (key) => Buffer.from(key, "base64").toString("utf-8");

console.log(bufferKey(process.env.BUFFER_KEY));
console.log(decodeKey(bufferKey(process.env.BUFFER_KEY)));
