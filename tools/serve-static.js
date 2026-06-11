const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "outputs");
const port = Number(process.env.PORT || 3000);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${port}`);
  const requested = url.pathname === "/" ? "/oneco-ai-workbench.html" : url.pathname;
  const filePath = path.resolve(root, `.${decodeURIComponent(requested)}`);

  if (!filePath.startsWith(root)) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(res, 404, "Not found");
      return;
    }

    send(res, 200, data, {
      "Content-Type": mime[path.extname(filePath)] || "application/octet-stream"
    });
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Static MVP running at http://localhost:${port}`);
});
