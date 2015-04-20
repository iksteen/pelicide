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
    'js/rst-editor'
], function(jQuery, _, Pelicide, MDEditor, RSTEditor) {
    // Set up jquery-jsonrpc default endpoint.
    jQuery.jsonRPC.setup({
        endPoint: '/rpc'
    });

    // Set up Pelicide UI.
    var pelicide = new Pelicide();
    pelicide.register(MDEditor);
    pelicide.register(RSTEditor);

    // Start Pelicide UI when DOM is ready.
    jQuery(function() {
        pelicide.run('#main_layout');
    });
});
