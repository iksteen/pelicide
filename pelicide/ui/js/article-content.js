define([
    'jquery'
], function(jQuery) {

    function ArticleContent(project) {
        this.project = project;
    }

    ArticleContent.prototype = {
        _nodeId: null,

        init: function () {
            this._nodeId = this.project.addContentType('Articles');
        },

        scan: function (file) {
            if (file.type == 'pelican.contents.Article') {
                return [this._nodeId, file.meta.category];
            }
        }
    };

    return ArticleContent;
});