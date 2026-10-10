@echo off
rem Avvia il pianificatore in locale: i moduli ES richiedono http://, non doppio clic su index.html.
rem serve.py manda Cache-Control: no-store, cosi' il JS aggiornato viene ricaricato sempre.
cd /d "%~dp0"
python serve.py 8123
