require.config({
    paths: {
        jquery: 'components/jquery/dist/jquery.min',
        jquery_jsonrpc: 'components/jquery-jsonrpc/jquery.jsonrpc',
        w2ui: 'components/w2ui/w2ui-1.4.2.min',
        cm: 'components/codemirror'
    },
    shim: {
        jquery_jsonrpc: ['jquery'],
        w2ui: ['jquery']
    }
});

require([
    'jquery',
    'jquery_jsonrpc',
    'js/pelicide',
    'js/md-editor',
    'js/rst-editor',
    'js/article-content'
], function(jQuery, _, Pelicide, MDEditor, RSTEditor, ArticleContent) {
    // Set up jquery-jsonrpc default endpoint.
    jQuery.jsonRPC.setup({
        endPoint: '/rpc'
    });

    // Register plugins.
    Pelicide.registerEditor(MDEditor);
    Pelicide.registerEditor(RSTEditor);
    Pelicide.registerContentType(ArticleContent);

    // Set up Pelicide UI.
    var pelicide = new Pelicide();

    // Start Pelicide UI when DOM is ready.
    jQuery(function() {
        pelicide.run('#main_layout');
    });
});
