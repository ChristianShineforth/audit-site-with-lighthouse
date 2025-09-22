export const isProduction = process.env.NODE_ENV === "production" && process.env.VERCEL === "1";

export const useBlob = isProduction && process.env.BLOB_READ_WRITE_TOKEN;
