# WordPress local para testar o plugin

## Opção A) LocalWP (fácil)
1. Baixe **Local** (by Flywheel) e crie um site WordPress (PHP 8.1+).
2. Copie `plugin-woo/` para `wp-content/plugins/gmc-shield/`.
3. Ative o plugin no WP Admin. Teste `GET /wp-json/gmc-shield/v1/status`.

## Opção B) Docker Compose (snip)
Crie `docker-compose.wp.yml` e cole:
```yaml
services:
  wp:
    image: wordpress:6.5-php8.1-apache
    ports: ["8080:80"]
    environment:
      WORDPRESS_DB_HOST: dbwp
      WORDPRESS_DB_USER: wp
      WORDPRESS_DB_PASSWORD: wp
      WORDPRESS_DB_NAME: wp
    volumes:
      - ./plugin-woo:/var/www/html/wp-content/plugins/gmc-shield
  dbwp:
    image: mysql:8
    environment:
      MYSQL_DATABASE: wp
      MYSQL_USER: wp
      MYSQL_PASSWORD: wp
      MYSQL_ROOT_PASSWORD: root
    command: --default-authentication-plugin=mysql_native_password
    volumes: [ "dbwp_data:/var/lib/mysql" ]
  phpmyadmin:
    image: phpmyadmin:latest
    ports: ["8081:80"]
    environment:
      PMA_HOST: dbwp
volumes:
  dbwp_data:
```
Suba:
```bash
docker compose -f docker-compose.wp.yml up -d
```
