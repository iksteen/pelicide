define([
    'jquery'
], function(jQuery) {

    function ArticleContent(sidebar) {
        this.sidebar = sidebar;
    }

    ArticleContent.prototype = {
        _nodeId: null,

        init: function () {
            this._nodeId = this.sidebar.addContentType('Articles');
        },

        scan: function (file) {
            if (file.type == 'pelican.contents.Article') {
                return [this._nodeId, file.meta.category];
            }
        }
    };

    return ArticleContent;
});