<?php
/**
 * Plugin Name: GMC Shield
 * Description: Ponte SaaS para risco GMC — políticas e bloqueio preventivo.
 * Version: 0.2.0
 * Author: You
 */

defined('ABSPATH') || exit;

class GMC_Shield {
    const OPT_API_URL = 'gmcshield_api_url';
    const OPT_STORE_ID = 'gmcshield_store_id';
    const OPT_TOKEN = 'gmcshield_api_token';
    const OPT_INTERVAL = 'gmcshield_interval';
    const TRANSIENT_BLOCKLIST = 'gmcshield_blocked_skus';
    const REST_NS = 'gmc-shield/v1';

    public function __construct() {
        add_action('admin_menu', [$this, 'settings_page']);
        add_action('admin_init', [$this, 'register_settings']);
        add_action('rest_api_init', [$this, 'register_routes']);
        add_filter('cron_schedules', [$this, 'add_cron_schedule']);
        add_action('gmcshield_sync', [$this, 'fetch_blocklist']);
        add_action('init', [$this, 'maybe_schedule']);
        add_filter('woocommerce_product_is_visible', [$this, 'filter_visible'], 10, 2);
        add_filter('woocommerce_is_purchasable', [$this, 'filter_purchasable'], 10, 2);
        add_filter('woocommerce_variation_is_visible', [$this, 'filter_variation_visible'], 10, 3);
        add_filter('woocommerce_variation_is_purchasable', [$this, 'filter_variation_purchasable'], 10, 2);
    }

    public function settings_page() {
        add_options_page('GMC Shield', 'GMC Shield', 'manage_options', 'gmc-shield', [$this, 'render_settings']);
    }

    public function register_settings() {
        register_setting('gmcshield', self::OPT_API_URL);
        register_setting('gmcshield', self::OPT_STORE_ID);
        register_setting('gmcshield', self::OPT_TOKEN);
        register_setting('gmcshield', self::OPT_INTERVAL);
    }

    public function render_settings() {
        ?>
        <div class="wrap">
            <h1>GMC Shield</h1>
            <form method="post" action="options.php">
                <?php settings_fields('gmcshield'); ?>
                <table class="form-table">
                    <tr><th scope="row">API URL</th><td><input type="text" name="<?php echo self::OPT_API_URL; ?>" value="<?php echo esc_attr(get_option(self::OPT_API_URL,'')); ?>" class="regular-text" /></td></tr>
                    <tr><th scope="row">Store ID</th><td><input type="text" name="<?php echo self::OPT_STORE_ID; ?>" value="<?php echo esc_attr(get_option(self::OPT_STORE_ID,'')); ?>" class="regular-text" /></td></tr>
                    <tr><th scope="row">API Token</th><td><input type="text" name="<?php echo self::OPT_TOKEN; ?>" value="<?php echo esc_attr(get_option(self::OPT_TOKEN,'')); ?>" class="regular-text" /></td></tr>
                    <tr><th scope="row">Intervalo (min)</th><td><input type="number" name="<?php echo self::OPT_INTERVAL; ?>" value="<?php echo esc_attr(get_option(self::OPT_INTERVAL,10)); ?>" /></td></tr>
                </table>
                <?php submit_button(); ?>

                <?php if ( current_user_can('manage_options') ):
                $nonce = wp_create_nonce('wp_rest'); ?>
                <hr>
                <h2>Testes rápidos</h2>

                <p>
                    <a class="button button-secondary" target="_blank"
                    href="<?php echo esc_url( rest_url( GMC_Shield::REST_NS . '/blocklist' ) . '?_wpnonce=' . $nonce ); ?>">
                    Abrir /blocklist no navegador
                    </a>
                </p>

                <p>
                    <button id="gmc-sync" class="button button-primary">Sincronizar agora (REST)</button>
                    <span id="gmc-sync-result" style="margin-left:.5rem;"></span>
                </p>

                <script>
                (function(){
                    const btn = document.getElementById('gmc-sync');
                    const out = document.getElementById('gmc-sync-result');
                    btn.addEventListener('click', function(e){
                    e.preventDefault();
                    out.textContent = 'Sincronizando...';
                    fetch('<?php echo esc_js( rest_url( GMC_Shield::REST_NS . '/sync' ) ); ?>', {
                        method: 'POST',
                        headers: { 'X-WP-Nonce': '<?php echo esc_js( $nonce ); ?>' }
                    })
                    .then(r => r.json())
                    .then(data => { out.textContent = 'OK: ' + JSON.stringify(data); })
                    .catch(err => { out.textContent = 'Erro: ' + err; });
                    });
                })();
                </script>
                <?php endif; ?>

            </form>
        </div>
        <?php
    }

    public function add_cron_schedule($schedules) {
        $interval = max(5, (int)get_option(self::OPT_INTERVAL, 10));
        $schedules['gmcshield'] = [
            'interval' => $interval * MINUTE_IN_SECONDS,
            'display'  => 'GMC Shield Sync'
        ];
        return $schedules;
    }

    public function maybe_schedule() {
        $interval = max(5, (int)get_option(self::OPT_INTERVAL, 10));
        $last = (int)get_option('gmcshield_last_interval', 0);
        if ($last !== $interval) {
            $ts = wp_next_scheduled('gmcshield_sync');
            if ($ts) wp_unschedule_event($ts, 'gmcshield_sync');
            update_option('gmcshield_last_interval', $interval);
        }
        if (!wp_next_scheduled('gmcshield_sync')) {
            wp_schedule_event(time(), 'gmcshield', 'gmcshield_sync');
        }
    }

    public function fetch_blocklist() {
        $api   = rtrim(get_option(self::OPT_API_URL), '/');
        $store = get_option(self::OPT_STORE_ID);
        $token = get_option(self::OPT_TOKEN);
        if (!$api || !$store || !$token) return;
        $url = $api . '/api/stores/' . $store . '/blocks';
        $res = wp_remote_get($url, [
            'headers' => ['Authorization' => 'Bearer ' . $token],
            'timeout' => 10,
        ]);
        if (is_wp_error($res)) return;

        $body  = json_decode(wp_remote_retrieve_body($res), true);
        $rows  = (is_array($body) && array_is_list($body)) ? $body : ($body['items'] ?? []);
        $items = array_map(fn($i) => $i['sku'] ?? $i['feed_item_id'] ?? null, $rows);
        $items = array_values(array_filter($items)); // remove nulls
        $map   = array_fill_keys($items, true);
        set_transient(self::TRANSIENT_BLOCKLIST, $map, 15 * MINUTE_IN_SECONDS);
        update_option('gmc_last_sync', time());
    }

    public function rest_sync( WP_REST_Request $req ) {
        $this->fetch_blocklist();
        $list = get_transient(self::TRANSIENT_BLOCKLIST) ?: [];
        return [
            'synced'     => true,
            'count'      => count($list),
            'last_sync'  => (int) get_option('gmc_last_sync'),
        ];
    }

    public function register_routes() {
        // Ping/healthcheck
        register_rest_route(self::REST_NS, '/status', [
            'methods'  => 'GET',
            'permission_callback' => '__return_true', // aberto para healthcheck
            'callback' => function () {
                global $wp_version;
                return [
                    'ok'         => true,
                    'plugin'     => 'gmc-shield',
                    'version'    => '0.2.0',
                    'namespace'  => self::REST_NS,
                    'site'       => home_url(),
                    'wp'         => $wp_version,
                    'last_sync'  => (int) get_option('gmc_last_sync'),
                    'has_blocklist' => (bool) get_transient(self::TRANSIENT_BLOCKLIST),
                ];
            },
        ]);

        // Sync manual (restrita a admin)
        register_rest_route(self::REST_NS, '/sync', [
            'methods'  => 'POST',
            'permission_callback' => function(){ return current_user_can('manage_options'); },
            'callback' => [$this, 'rest_sync'],
        ]);

        // Blocklist (restrita a admin)
        register_rest_route(self::REST_NS, '/blocklist', [
            'methods'  => 'GET',
            'permission_callback' => function () { return current_user_can('manage_options'); },
            'callback' => function () {
                return [
                    'items'     => array_keys(get_transient(self::TRANSIENT_BLOCKLIST) ?: []),
                    'last_sync' => (int) get_option('gmc_last_sync'),
                ];
            },
        ]);
    }

    public static function in_blocklist($sku) {
        $list = get_transient(self::TRANSIENT_BLOCKLIST) ?: [];
        return $sku && isset($list[$sku]);
    }

    public static function product_or_variations_blocked($product) {
        $sku = $product->get_sku();
        if ($sku && self::in_blocklist($sku)) return true;
        if ($product->is_type('variable')) {
            foreach ($product->get_children() as $vid) {
                $vsku = get_post_meta($vid, '_sku', true);
                if ($vsku && self::in_blocklist($vsku)) return true;
            }
        }
        return false;
    }

    public function filter_visible($vis, $product_id) {
        $product = wc_get_product($product_id);
        if ($product && self::product_or_variations_blocked($product)) return false;
        return $vis;
    }

    public function filter_purchasable($purch, $product) {
        if ($product && self::product_or_variations_blocked($product)) return false;
        return $purch;
    }

    public function filter_variation_visible($visible, $variation_id, $parent_id) {
        $sku = get_post_meta($variation_id, '_sku', true);
        if ($sku && self::in_blocklist($sku)) return false;
        return $visible;
    }

    public function filter_variation_purchasable($purchasable, $variation) {
        $sku = $variation ? $variation->get_sku() : '';
        if ($sku && self::in_blocklist($sku)) return false;
        return $purchasable;
    }

}

new GMC_Shield();

// Habilita Application Passwords em ambiente local (sem HTTPS).
add_filter('wp_is_application_passwords_available', function ($available) {
    // normaliza host removendo porta e forçando minúsculas
    $host = strtolower($_SERVER['HTTP_HOST'] ?? '');
    $host = preg_replace('/:\d+$/', '', $host);

    // habilita em localhost/127.0.0.1 ou quando WP_ENVIRONMENT_TYPE = local/development
    if (in_array($host, ['localhost', '127.0.0.1'], true)) {
        return true;
    }
    if (function_exists('wp_get_environment_type') && in_array(wp_get_environment_type(), ['local','development'], true)) {
        return true;
    }
    return $available;
});

?>
