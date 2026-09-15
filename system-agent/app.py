from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import psutil
import socket
import time


class SystemHandler(BaseHTTPRequestHandler):

    def do_GET(self):

        if self.path == "/system":

            memory = psutil.virtual_memory()
            disk = psutil.disk_usage("/")

            data = {
                "hostname": socket.gethostname(),
                "cpu": round(psutil.cpu_percent(interval=0.2), 1),
                "ram": round(memory.percent, 1),
                "disk": round(disk.percent, 1),
                "uptimeSeconds": int(time.time() - psutil.boot_time())
            }

            response = json.dumps(data).encode("utf-8")

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

            self.wfile.write(response)

        else:
            self.send_response(404)
            self.end_headers()


server = HTTPServer(
    ("127.0.0.1", 9000),
    SystemHandler
)

print("HOME LAB SYSTEM AGENT")
print("Listening on port 9000")

server.serve_forever()
