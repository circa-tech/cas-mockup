"""Run the production app against synthetic data using Apple's Safari WebDriver."""

import base64
import io
import json
import subprocess
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from contextlib import ExitStack

APP = "http://127.0.0.1:4948/cas-mockup/"
DRIVER = "http://127.0.0.1:4549"
ELEMENT = "element-6066-11e4-a52e-4f735466cecf"


def webdriver(method, path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(
        DRIVER + path,
        data=data,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)["value"]
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"Safari WebDriver {method} {path}: {exc.read().decode()}") from exc


def until(action, description, timeout=16):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        value = action()
        if value:
            return value
        time.sleep(0.2)
    raise AssertionError(f"Timed out: {description}")


def ready(url):
    try:
        with urllib.request.urlopen(url, timeout=1) as response:
            return response.status == 200
    except OSError:
        return False


class Safari:
    def __init__(self, session):
        self.session = f"/session/{session}"

    def send(self, command, params, method="POST"):
        return webdriver(method, self.session + command, params)

    def js(self, script, *args):
        return self.send("/execute/sync", {"script": script, "args": args})

    def click(self, selector, label):
        element = until(
            lambda: self.js(
                """
                return Array.from(document.querySelectorAll(arguments[0]))
                  .find(el => el.textContent.trim() === arguments[1] && !el.disabled && el.offsetWidth);
                """,
                selector, label,
            ),
            f"enabled button {label!r}",
        )
        self.send(f"/element/{element[ELEMENT]}/click", {})

    def drag(self, selector, delta):
        x, y = self.js(
            """
            const target = document.querySelector(arguments[0]);
            target.scrollIntoView({ block: 'center' });
            const { x, y, width, height } = target.getBoundingClientRect();
            return [Math.round(x + width / 2), Math.round(y + height / 2)];
            """,
            selector,
        )
        moves = [
            {"type": "pointerMove", "duration": 20, "origin": "viewport", "x": round(x + delta * i / 20), "y": y}
            for i in range(1, 21)
        ]
        self.send("/actions", {"actions": [{
            "type": "pointer",
            "id": "mouse",
            "parameters": {"pointerType": "mouse"},
            "actions": [
                {"type": "pointerMove", "duration": 0, "origin": "viewport", "x": x, "y": y},
                {"type": "pointerDown", "button": 0},
                *moves,
                {"type": "pointerUp", "button": 0},
            ],
        }]})

    def export(self, start, end, expected_rows):
        self.js("window.platformExport = null")
        self.click(".well-chart-panel button", "Descargar")
        export = until(lambda: self.js("return window.platformExport"), "generated XLSX")
        assert export["filename"].endswith(f"{start}_{end}.xlsx"), export["filename"]

        with zipfile.ZipFile(io.BytesIO(base64.b64decode(export["data"]))) as workbook:
            worksheet = ET.fromstring(workbook.read("xl/worksheets/sheet1.xml"))
        rows = worksheet.findall(".//{*}row")
        assert len(rows) == expected_rows + 1, len(rows)
        print(f"Verified {export['filename']}: {expected_rows} readings", flush=True)
        return worksheet


def exercise(safari):
    safari.send("/url", {"url": APP})
    agent = safari.js("return navigator.userAgent;")
    assert "Safari/" in agent and "Chrome/" not in agent, agent
    print(agent, flush=True)
    safari.click("button", "Iniciar sesión")
    until(
        lambda: safari.js("return !!document.querySelector('input[type=password]')"),
        "login form",
    )
    safari.js("""
        const inputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        for (const [selector, value] of [['input[type=email]', 'alice@example.test'], ['input[type=password]', 'offline-test-password']]) {
          const field = document.querySelector(selector);
          inputValue.call(field, value);
          field.dispatchEvent(new Event('input', { bubbles: true }));
        }
    """)
    safari.click("button", "Ingresar")
    safari.click("nav button", "Pozos")
    until(lambda: safari.js("return !!document.querySelector('.well-chart-controls select')"), "well chart")
    safari.js("""
        const selector = document.querySelector('.well-chart-controls select');
        selector.value = 'all';
        selector.dispatchEvent(new Event('change', { bubbles: true }));
    """)

    until(lambda: safari.js("return document.querySelectorAll('.recharts-brush [role=slider]').length === 2"),
          "two brush handles")
    # The stable role query avoids assuming Recharts's sibling elements or brush tooltip position.
    safari.js("""
        document.querySelectorAll('.recharts-brush [role=slider]').forEach((el, index) =>
          el.dataset.qaHandle = String(index));
    """)
    left, right = "[data-qa-handle='0']", "[data-qa-handle='1']"
    step = safari.js("""
        const [left, right] = document.querySelectorAll('.recharts-brush [role=slider]');
        return (right.getBoundingClientRect().x - left.getBoundingClientRect().x) / 5;
    """)

    safari.export("2026-10-01", "2026-10-06", 6)
    safari.drag(left, 2.25 * step)
    safari.export("2026-10-03", "2026-10-06", 4)
    safari.drag(right, -1.75 * step)
    safari.export("2026-10-03", "2026-10-04", 2)
    safari.drag(".recharts-brush .recharts-brush-slide", -1.75 * step)
    worksheet = safari.export("2026-10-01", "2026-10-02", 2)
    second_reading = worksheet.find(".//{*}row[@r='3']")
    assert second_reading.find("./{*}c[@r='B3']/{*}v") is None
    assert second_reading.find("./{*}c[@r='D3']/{*}v").text == "0"
    safari.click(".well-chart-panel button", "Restablecer rango")
    safari.export("2026-10-01", "2026-10-06", 6)


def terminate(process):
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


with ExitStack() as stack:
    server = subprocess.Popen(["node", "scripts/platform-qa/serve.mjs"])
    stack.callback(terminate, server)
    driver = subprocess.Popen(["/usr/bin/safaridriver", "-p", "4549"])
    stack.callback(terminate, driver)
    until(lambda: ready(APP), "fixture server")
    until(lambda: ready(DRIVER + "/status"), "Safari WebDriver")
    native = webdriver("POST", "/session", {"capabilities": {"alwaysMatch": {"browserName": "safari"}}})
    safari = Safari(native["sessionId"])
    stack.callback(webdriver, "DELETE", safari.session)
    print(f"Safari capabilities: {native['capabilities']}", flush=True)
    try:
        exercise(safari)
    except Exception:
        print(safari.js("return document.body.innerText.slice(0, 3200);"), flush=True)
        raise
