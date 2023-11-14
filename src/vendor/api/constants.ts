// From https://github.com/proofcarryingdata/zupass/blob/main/packages/passport-interface/src/SemaphoreSignatureIntegration.ts
// Modified to fix import bugs

export const POST = {
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  method: "POST",
} as const;
