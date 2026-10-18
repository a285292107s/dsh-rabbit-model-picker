var RECOVERED_CODE = "RATE_LIMIT";
var RATE_LIMIT_WORDING = Object.freeze([
  "\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41",
  "\u5F53\u524D\u5E76\u53D1\u5DF2\u8FBE\u4E0A\u9650",
  "\u5E76\u53D1\u5DF2\u8FBE\u4E0A\u9650",
  "\u8BF7\u6C42\u6570\u9650\u5236",
  "requests are too frequent",
  "\u8BBF\u95EE\u8FC7\u4E8E\u9891\u7E41",
  "\u64CD\u4F5C\u8FC7\u4E8E\u9891\u7E41",
  "\u8BF7\u6C42\u8FC7\u4E8E\u5BC6\u96C6",
  "\u901F\u7387\u9650\u5236",
  "\u89E6\u53D1\u9650\u6D41",
  "too many requests"
]);
function statusBlocksPromotion(status) {
  if (typeof status !== "number" || !Number.isFinite(status)) return false;
  if (status === 429 || status === 408) return false;
  if (status >= 500) return false;
  return true;
}
function readFailure(value) {
  if (typeof value !== "object" || value === null) return null;
  const message = value.message;
  const code = value.code;
  if (typeof message !== "string" || typeof code !== "string") return null;
  return value;
}
function readRetryableCodes(value) {
  if (typeof value !== "object" || value === null) return null;
  const codes = value.retryableCodes;
  if (!Array.isArray(codes)) return null;
  return codes.filter((code) => typeof code === "string");
}
function statesRateLimit(message) {
  const text = message.toLowerCase();
  return RATE_LIMIT_WORDING.some((wording) => text.includes(wording.toLowerCase()));
}
function recoverRateLimitFailure(failure, policy) {
  const read = readFailure(failure);
  if (read === null) return null;
  const codes = readRetryableCodes(policy);
  if (codes === null || !codes.includes(RECOVERED_CODE)) return null;
  if (codes.includes(read.code)) return null;
  if (statusBlocksPromotion(read.status)) return null;
  if (!statesRateLimit(read.message)) return null;
  return { ...read, code: RECOVERED_CODE };
}

function apply(ctx) {
  ctx.on(
    "agent/request-error",
    (payload, next) => {
      const recovered = recoverRateLimitFailure(payload.failure, payload.retryPolicy);
      if (recovered !== null) payload.failure = recovered;
      return next();
    },
    { prepend: true }
  );
}
export {
  apply
};
