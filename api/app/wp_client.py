# api/app/wp_client.py

import base64
import httpx

def wp_client(base: str, user: str, app_pass: str, verify=True, timeout=10) -> httpx.Client:
    tok = base64.b64encode(f"{user}:{app_pass}".encode()).decode()
    return httpx.Client(
        # Mantém "/" no final para o httpx fazer join correto com caminhos relativos.
        base_url=base.rstrip('/') + '/',
        headers={"Authorization": f"Basic {tok}"},
        timeout=timeout,
        verify=verify,
    )
