import util from 'util';
import zlib from "zlib";

const gzip = util.promisify(zlib.gzip);
const gunzip = util.promisify(zlib.gunzip);
const isDevOrLocal = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'local';

export const compressData = async (data: any): Promise<string> => {
  const jsonData = JSON.stringify(data);
  const compressedData = await gzip(jsonData);
  return compressedData.toString('base64');
}

export const decompressData = async (compressedData) => {
  const buffer = Buffer.from(compressedData, "base64");
  const decompressedData = await gunzip(buffer);
  return JSON.parse(decompressedData.toString());
};

export const log = (message: string, ...optionalParams: any[]) => {
  console.log(`[LOG] ${message}`, ...optionalParams);
};

export const error = (message: string, ...optionalParams: any[]) => {
  console.error(`[ERROR] ${message}`, ...optionalParams);
};
