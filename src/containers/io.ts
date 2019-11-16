import * as fs from 'fs-extra';
import * as path from 'path';

/**
 * Converts a JavaScript Object Notation (JSON) string into a typed object.
 * @param json A valid JSON string.
 * @return A typed object (or nested array of objects).
 */
export const deserialize = <T>(json: string) => {
  return JSON.parse(json) as T;
}

/**
 * Extract the file extension from the path. Returns the extension after 
 * the last period character in the path, otherwise returns full path if 
 * first character is a period or no period exists.
 * @param filepath The relative or absolute path to evaluate.
 * @return A string containing the file extension.
 */
export const extractExtension = (filepath: fs.PathLike) => {
  const ext = filepath.toString().split('.').pop();
  if (ext === undefined) return filepath.toString();
  else return ext;
}

/**
 * Asynchronously read file contents into a string.
 * @param filepath A valid filename or path to read from.
 * @return A Promise object for a string containing the file contents.
 */
export const readFileAsync = (filepath: fs.PathLike): Promise<string> => {
  return new Promise((resolve, reject) => {
    fs.readFile(path.resolve(filepath.toString()), (error, result) => {
      if (error) reject(error);
      else resolve(result.toString());
    });
  });
}

/**
 * Asynchronously write data to a file. Creates a new file if none exists; will 
 * destructively rewrite existing files.
 * @param filepath A valid filename or path to write data to.
 * @param data A string containing content.
 */
export const writeFileAsync = (filepath: fs.PathLike, data: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    fs.writeFile(path.resolve(filepath.toString()), data, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}