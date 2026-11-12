"""Servidor local de desenvolvimento: igual ao `python -m http.server`, mas manda o navegador
NÃO guardar cache (senão um F5 ainda roda os módulos js/ antigos).
Uso (dentro de matelandia-3d/): python tools/servidor.py [porta]   → http://localhost:8737
"""
import http.server, os, sys

class SemCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

if __name__ == '__main__':
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else 8737
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
    http.server.ThreadingHTTPServer(('127.0.0.1', porta), SemCache).serve_forever()
