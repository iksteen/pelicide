Promise.all([
    System.import('jquery'),
    System.import('js/pelicide'),
    System.import('js/md-editor'),
    System.import('js/rst-editor'),
    System.import('js/article-content'),
    System.import('js/api'),
    System.import('js/util')
]).then(function (m) { (function(jQuery, Pelicide, MDEditor, RSTEditor, ArticleContent, API, Util) {
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
}).apply(this, m); });
