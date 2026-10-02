/* Anteprima locale di dist/ — http://localhost:8080 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
  ".xml": "application/xml", ".txt": "text/plain", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp" };
const PORT = +process.env.PORT || 8080;

createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (path.includes("..")) { res.writeHead(400); return res.end(); }
  if (path.endsWith("/")) path += "index.html";
  else if (!extname(path)) path += "/index.html";
  try {
    const body = await readFile(join(DIST, path));
    res.writeHead(200, { "Content-Type": TYPES[extname(path)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": TYPES[".html"] });
    res.end(await readFile(join(DIST, "404.html")).catch(() => "404"));
  }
}).listen(PORT, () => console.log(`Anteprima: http://localhost:${PORT}`));
