// Runtime configuration. This MVP defaults to mock mode; real-data mode is a
// future step and is not required here.

export const MOCK_MODE = process.env.MOCK_MODE !== "false";

export const B20_NETWORK = process.env.B20_NETWORK ?? "base";
