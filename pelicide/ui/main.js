require.config({
    deps: ['components/es6-promise/promise.min'],
    paths: {
        // Uncomment the next line to activate demo mode.
        //'js/api': 'js/demo-mode',
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
    'js/api',
    'js/util'
], function(jQuery, Pelicide, MDEditor, RSTEditor, ArticleContent, API, Util) {
    // Set up API endpoint.
    API.configure('/rpc');

    // Start Pelicide UI when DOM is ready.
    jQuery(function() {
        API.get('SITENAME').then(function (sitename) {
            document.title = sitename + ' (Pelicide)';

            // Set up and start Pelicide UI.
            var pelicide = new Pelicide({
                sitename: sitename || '',
                contentTypes: [
                    ArticleContent
                ],
                editors: [
                    MDEditor,
                    RSTEditor
                ]
            });
            pelicide.run('#main_layout');
            // Uncomment the next line to automatically open the demo document.
            //setTimeout(function () { pelicide.editor.open([], 'welcome-to-pelicide.md'); }, 0);
        }).catch(Util.alert);
    });
});
