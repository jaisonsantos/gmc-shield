<?php
/**
 * Plugin Name: GMC Shield
 * Description: Ponte SaaS para risco GMC — políticas e bloqueio preventivo.
 * Version: 0.1.1
 * Author: You
 * Requires at least: 6.0
 * Requires PHP: 8.1
 */

defined('ABSPATH') || exit;

class GMC_Shield {
    private static $instance = null;

    public static function instance() {
        if ( self::$instance === null ) self::$instance = new self();
        return self::$instance;
    }

    private function __construct() {
        add_action('rest_api_init', [$this, 'register_routes']);
        add_action('add_meta_boxes', [$this, 'add_metabox']);
        add_filter('manage_product_posts_columns', [$this, 'add_column']);
        add_action('manage_product_posts_custom_column', [$this, 'render_column'], 10, 2);
    }

    public function register_routes() {
        register_rest_route('gmc-shield/v1', '/status', [
            'methods'  => 'GET',
            'permission_callback' => '__return_true',
            'callback' => function () {
                return rest_ensure_response(['ok' => true, 'version' => '0.1.1']);
            },
        ]);

        register_rest_route('gmc-shield/v1', '/policy', [
            'methods'  => 'POST',
            'permission_callback' => function(){ return current_user_can('edit_pages'); },
            'callback' => [$this, 'create_or_update_policy'],
            'args' => [
                'type' => ['type' => 'string', 'required' => false],
                'content_html' => ['type' => 'string', 'required' => false],
            ],
        ]);

        register_rest_route('gmc-shield/v1', '/block', [
            'methods'  => 'POST',
            'permission_callback' => function(){ return current_user_can('edit_products'); },
            'callback' => [$this, 'block_product'],
            'args' => [
                'product_id' => ['type' => 'integer', 'required' => true],
            ],
        ]);
    }

    public function create_or_update_policy( WP_REST_Request $request ) {
        $params  = $request->get_json_params();
        $title   = 'Policy: ' . sanitize_text_field($params['type'] ?? 'Untitled');
        $content = wp_kses_post($params['content_html'] ?? '<p>...</p>');

        $post_id = wp_insert_post([
            'post_title'   => $title,
            'post_content' => $content,
            'post_status'  => 'publish',
            'post_type'    => 'page',
        ]);

        if ( is_wp_error($post_id) ) {
            return new WP_Error('policy_error', 'Erro ao criar página', ['status' => 500]);
        }

        return rest_ensure_response(['id' => $post_id, 'url' => get_permalink($post_id)]);
    }

    public function block_product( WP_REST_Request $request ) {
        // valida nonce do REST (enviado no header X-WP-Nonce)
        $nonce = $request->get_header('X-WP-Nonce');
        if ( ! $nonce || ! wp_verify_nonce($nonce, 'wp_rest') ) {
            return new WP_Error('rest_forbidden', 'Nonce inválido', ['status' => 401]);
        }

        $product_id = (int) $request->get_param('product_id');
        if ( ! $product_id ) {
            return new WP_Error('bad_request', 'product_id é obrigatório', ['status' => 400]);
        }

        update_post_meta($product_id, '_gmc_shield_exclude', 1);
        return rest_ensure_response(['product_id' => $product_id, 'excluded' => true]);
    }

    public function add_metabox() {
        add_meta_box('gmc_shield_metabox', 'Risco GMC', [$this, 'render_metabox'], 'product', 'side', 'core');
    }

    public function render_metabox( $post ) {
        $excluded = get_post_meta($post->ID, '_gmc_shield_exclude', true) ? 'Sim' : 'Não';

        // prepara dados de forma segura
        $endpoint = esc_url_raw( rest_url('gmc-shield/v1/block') );
        $nonce    = wp_create_nonce('wp_rest');
        $pid      = (int) $post->ID;

        echo '<p><strong>Excluir do feed:</strong> ' . esc_html($excluded) . '</p>';
        echo '<button type="button" class="button" id="gmc-exclude">Excluir do feed</button>';

        // script com dados embutidos corretamente
        ?>
        <script>
        (function(){
          const btn = document.getElementById('gmc-exclude');
          if (!btn) return;
          btn.addEventListener('click', async () => {
            try {
              const res = await fetch(<?php echo wp_json_encode($endpoint); ?>, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-WP-Nonce': <?php echo wp_json_encode($nonce); ?>
                },
                body: JSON.stringify({ product_id: <?php echo (int) $pid; ?> })
              });
              if (res.ok) {
                location.reload();
              } else {
                const j = await res.json().catch(()=>({}));
                alert('Falha ao bloquear: ' + (j.message || res.status));
              }
            } catch (e) {
              alert('Erro de rede: ' + e);
            }
          });
        })();
        </script>
        <?php
    }

    public function add_column( $columns ) {
        $columns['gmc_risk'] = 'GMC Risk';
        return $columns;
    }

    public function render_column( $column, $post_id ) {
        if ( $column === 'gmc_risk' ) {
            $excluded = get_post_meta($post_id, '_gmc_shield_exclude', true) ? 'Blocked' : 'OK';
            echo esc_html($excluded);
        }
    }
}

GMC_Shield::instance();
