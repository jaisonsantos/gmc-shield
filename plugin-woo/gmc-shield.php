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
        $items = isset($body['items']) ? array_map(function($i){ return isset($i['sku']) ? $i['sku'] : $i['feed_item_id']; }, $body['items']) : [];
        $map   = array_fill_keys($items, true);
        set_transient(self::TRANSIENT_BLOCKLIST, $map, 15 * MINUTE_IN_SECONDS);
        update_option('gmc_last_sync', time());
    }

    public function register_routes() {
        register_rest_route('gmcshield/v1', '/blocklist', [
            'methods'  => 'GET',
            'permission_callback' => function(){ return current_user_can('manage_options'); },
            'callback' => function(){
                return [
                    'items' => array_keys(get_transient(self::TRANSIENT_BLOCKLIST) ?: []),
                    'last_sync' => (int) get_option('gmc_last_sync')
                ];
            }
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

?>
