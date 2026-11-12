@echo off
rem Duplo clique: liga o servidor local do Matelandia 3D e abre o jogo no navegador.
rem Deixe esta janela aberta enquanto joga; para desligar, feche a janela.
cd /d "%~dp0"
start "" http://localhost:8737/
python tools\servidor.py 8737
