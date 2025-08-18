import base64
import httpx


def wp_client(base: str, user: str, app_pass: str, verify=True, timeout=10) -> httpx.Client:
    tok = base64.b64encode(f"{user}:{app_pass}".encode()).decode()
    return httpx.Client(
        base_url=base.rstrip('/'),
        headers={"Authorization": f"Basic {tok}"},
        timeout=timeout,
        verify=verify,
    )
