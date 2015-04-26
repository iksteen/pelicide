require.config({
    deps: ['components/es6-promise/promise.min'],
    paths: {
        jquery: 'components/jquery/dist/jquery.min',
        jquery_jsonrpc: 'components/jquery-jsonrpc/jquery.jsonrpc',
        jquery_dateFormat: 'components/jquery-dateFormat/dist/jquery-dateFormat.min',
        w2ui: 'components/w2ui/w2ui-1.4.2.min',
        cm: 'components/codemirror',
        unorm: 'components/unorm/lib/unorm'
    },
    shim: {
        jquery_jsonrpc: ['jquery'],
        jquery_dateFormat: ['jquery'],
        w2ui: ['jquery']
    }
});

require([
    'jquery',
    'js/pelicide',
    'js/md-editor',
    'js/rst-editor',
    'js/article-content',
    'js/api'
], function(jQuery, Pelicide, MDEditor, RSTEditor, ArticleContent, API) {
    // Set up API endpoint.
    API.configure('/rpc');

    // Set up Pelicide UI.
    var pelicide = new Pelicide({
        contentTypes: [
            ArticleContent
        ],
        editors: [
            MDEditor,
            RSTEditor
        ]
    });

    // Start Pelicide UI when DOM is ready.
    jQuery(function() {
        pelicide.run('#main_layout');
    });
});
