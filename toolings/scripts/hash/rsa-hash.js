import { generateKeyPairSync, publicEncrypt, privateDecrypt } from "crypto";

// 模擬 b 點生成公私鑰對
function generateKeys() {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });
  return { publicKey, privateKey };
}

// a 點：加密數據
function encryptData(data, publicKey) {
  const buffer = Buffer.from(data, "utf8");
  const encrypted = publicEncrypt(publicKey, buffer);
  return encrypted.toString("base64");
}

// b 點：解密數據
function decryptData(encryptedData, privateKey) {
  const buffer = Buffer.from(encryptedData, "base64");
  const decrypted = privateDecrypt(privateKey, buffer);
  return decrypted.toString("utf8");
}

// 主程式：模擬 a 點和 b 點的互動
function main() {
  // b 點生成密鑰
  const { publicKey, privateKey } = generateKeys();
  console.log("公鑰 (b 點提供給 a 點):", publicKey);
  console.log("私鑰 (b 點保留):", privateKey);

  // a 點的原始數據
  const originalData = "你好，這是秘密訊息！";
  console.log("\na 點原始數據:", originalData);

  // a 點加密
  const encryptedData = encryptData(originalData, publicKey);
  console.log('a 點加密後的 "hash":', encryptedData);

  // b 點解密
  const decryptedData = decryptData(encryptedData, privateKey);
  console.log("b 點解密後的數據:", decryptedData);
}

// 執行
main();
