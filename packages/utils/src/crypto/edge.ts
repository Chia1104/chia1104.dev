export const getKey = (hashSecret: string) =>
  crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(hashSecret),
    { name: "HMAC", hash: { name: "SHA-256" } },
    false,
    ["sign"]
  );

export const toHex = (arrayBuffer: ArrayBuffer) => {
  return Array.prototype.map
    .call(new Uint8Array(arrayBuffer), (n: number) =>
      n.toString(16).padStart(2, "0")
    )
    .join("");
};

// export const verifyInput = async (key: CryptoKey, input: string) =>
//   toHex(
//     await crypto.subtle.sign(
//       "HMAC",
//       key,
//       new TextEncoder().encode(JSON.stringify({ input }))
//     )
//   );
