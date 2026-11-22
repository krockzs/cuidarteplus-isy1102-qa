"""EP5 IL 3.3: Selenium WebDriver contra el laboratorio local sintético.

No cambia datos clínicos; las credenciales provienen del fixture público QA.
"""
import os
import re
import shutil
from pathlib import Path
from urllib.parse import urlsplit

import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

URL = os.environ.get("EP5_FRONTEND_URL", "http://127.0.0.1:3333").rstrip("/")
assert urlsplit(URL).hostname in {"127.0.0.1", "localhost"}, "Ejecución limitada a loopback"
SHOTS = Path(os.environ.get("EP5_SCREENSHOTS", "QA/reportes/ep5-33/screenshots"))
SHOTS.mkdir(parents=True, exist_ok=True)
USER = os.environ.get("EP5_QA_USER", "qa_admin")
PASSWORD = os.environ.get("EP5_QA_PASSWORD", "demo_admin_qa")


@pytest.fixture
def driver(request):
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1440,900")
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-background-networking")
    chrome = shutil.which("google-chrome") or shutil.which("chromium")
    if chrome:
        options.binary_location = chrome
    browser = webdriver.Chrome(options=options)
    browser.set_page_load_timeout(35)
    try:
        yield browser
    finally:
        filename = re.sub(r"[^a-zA-Z0-9_-]", "_", request.node.name)
        try:
            browser.save_screenshot(str(SHOTS / f"final_{filename}.png"))
        except Exception:
            pass
        browser.quit()


def open_login(browser):
    browser.get(f"{URL}/login")
    WebDriverWait(browser, 20).until(
        EC.visibility_of_element_located((By.ID, "nombre_usuario"))
    )


def login(browser, password=PASSWORD):
    open_login(browser)
    browser.find_element(By.ID, "nombre_usuario").send_keys(USER)
    browser.find_element(By.ID, "password").send_keys(password)
    browser.find_element(By.CSS_SELECTOR, '[data-testid="button-login"]').click()


def test_01_pantalla_login_muestra_campos_y_enlace(driver):
    open_login(driver)
    assert driver.find_element(By.ID, "password").get_attribute("type") == "password"
    assert driver.find_element(By.CSS_SELECTOR, '[data-testid="link-registro"]').is_displayed()
    assert "Iniciar Sesión" in driver.page_source
    driver.save_screenshot(str(SHOTS / "01_login_publico.png"))


def test_02_ruta_privada_redirige_al_login(driver):
    driver.get(f"{URL}/pacientes")
    WebDriverWait(driver, 15).until(EC.url_contains("/login"))
    assert driver.find_element(By.ID, "nombre_usuario").is_displayed()
    driver.save_screenshot(str(SHOTS / "02_redireccion_sin_sesion.png"))


def test_03_formulario_vacio_presenta_validaciones(driver):
    open_login(driver)
    driver.find_element(By.CSS_SELECTOR, '[data-testid="button-login"]').click()
    WebDriverWait(driver, 10).until(
        EC.text_to_be_present_in_element(
            (By.TAG_NAME, "body"), "El nombre de usuario es requerido"
        )
    )
    assert "La contraseña es requerida" in driver.page_source
    driver.save_screenshot(str(SHOTS / "03_formulario_requerido.png"))


def test_04_credenciales_erroneas_son_rechazadas(driver):
    login(driver, password="clave_qa_erronea_2026")
    WebDriverWait(driver, 15).until(
        EC.text_to_be_present_in_element((By.TAG_NAME, "body"), "Credenciales inválidas")
    )
    assert "/home" not in driver.current_url
    driver.save_screenshot(str(SHOTS / "04_login_rechazado.png"))


def test_05_login_valido_accede_al_home(driver):
    login(driver)
    WebDriverWait(driver, 35).until(EC.url_contains("/home"))
    WebDriverWait(driver, 35).until(
        EC.text_to_be_present_in_element((By.TAG_NAME, "body"), "Bienvenido")
    )
    assert "qa_admin" in driver.page_source
    driver.save_screenshot(str(SHOTS / "05_login_valido.png"))


def test_06_admin_navega_a_pacientes(driver):
    login(driver)
    WebDriverWait(driver, 35).until(EC.url_contains("/home"))
    driver.get(f"{URL}/pacientes")
    WebDriverWait(driver, 30).until(
        EC.text_to_be_present_in_element((By.TAG_NAME, "body"), "Gestión de Pacientes")
    )
    assert "/pacientes" in driver.current_url
    driver.save_screenshot(str(SHOTS / "06_gestion_pacientes.png"))
