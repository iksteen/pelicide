define([
    'jquery'
], function(jQuery) {

    function ArticleContent(pelicide) {
        this.pelicide = pelicide;
    }

    ArticleContent.prototype = {
        init: function () {
            this.pelicide.createContentTypeNode({
                id: 'articles',
                text: 'Articles',
                icon: 'fa fa-folder'
            })
        },

        scan: function (file) {
            return file.type == 'pelican.contents.Article' ? 'articles' : null;
        }
    };

    return ArticleContent;
});