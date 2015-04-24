define([
    'jquery'
], function(jQuery) {

    function ArticleContent(pelicide) {
        this.pelicide = pelicide;
    }

    ArticleContent.prototype = {
        _nodeId: null,

        init: function () {
            this._nodeId = this.pelicide.sidebar.addContentType('Articles');
        },

        scan: function (file) {
            if (file.type == 'pelican.contents.Article') {
                return [this._nodeId, file.meta.category];
            }
        }
    };

    return ArticleContent;
});