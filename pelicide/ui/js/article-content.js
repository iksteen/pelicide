define([
    'js/util',
    'js/api',
    'jquery',
    'jquery_dateFormat'
], function(Util, API, jQuery) {

    function ArticleContent(project) {
        this.project = project;
        this._draftNodeId = null;
        this._publishedNodeId = null;
    }

    function getPathFromRecord(record) {
        return {
            path: record.create_in ? record.create_in.split('/') : [],
            name: Util.slugify(record.title) + '.' + record.format.id
        }
    }

    ArticleContent.prototype = {
        init: function () {
            var self = this;

            this._draftNodeId = this.project.addContentType('Draft articles');
            this._publishedNodeId = this.project.addContentType('Published articles');

            var formats = [];
            jQuery.each(this.project.pelicide.editor.editors, function(f, e) {
                if (e.templates && e.templates.article)
                    formats.push(f);
            });
            this._form = $().w2form({
                name: 'create_article',
                style: 'border: 0px; background-color: transparent;',
                fields: [
                    {field: 'title', type: 'text', required: true, html: {caption: 'Title', attr: 'style="width: 250px"'}},
                    {field: 'category', type: 'combo', html: {caption: 'Category:', attr: 'style="width: 250px"'}},
                    {field: 'status', type: 'list', required: true, options: {items: ['draft', 'published']}, html: {caption: 'Status', attr: 'style="width: 250px"'}},
                    {field: 'format', type: 'list', required: true, options: {items: formats}, html: {caption: 'Format', attr: 'style="width: 250px"'}},
                    {field: 'create_in', type: 'combo', html: {caption: 'Create in:', attr: 'style="width: 250px"'}}
                ],
                record: {},
                actions: {
                    Cancel: function () {
                        this.cancel();
                    },
                    Create: function () {
                        this.ok();
                    }
                },
                onValidate: function (event) {
                    var path = getPathFromRecord(this.record);
                    if (self.project.getFile(path.path, path.name) !== undefined) {
                        event.errors.push({
                            field: this.get('title'),
                            error: 'File already exists'
                        });
                    }
                }
            });

            this.project.addCreateContent({
                text: 'Create article',
                icon: 'fa fa-newspaper-o',
                onClick: function () {
                    self.create();
                }
            });
        },

        scan: function (file) {
            if (file.type == 'pelican.contents.Article') {
                if (file.status.toLowerCase() == 'draft')
                    return [this._draftNodeId];
                else
                    return [this._publishedNodeId, file.meta.category];
            }
        },

        create: function () {
            var self = this,
                categories = this.project.categories();

            return API.get('ARTICLE_PATHS')
                .then(function (article_paths) {
                    self._form.set('category', {options: {items: categories}});
                    self._form.set('create_in', {options: {items: article_paths}});
                    self._form.record = {
                        status: 'draft',
                        format: self._form.get('format').options.items[0],
                        create_in: article_paths[0]
                    };

                    return Util.dialog({
                        title: 'Create article',
                        form: self._form
                    })
                })
                .then(function (record) {
                    jQuery.extend(record, {
                        slug: Util.slugify(record.title),
                        date: jQuery.format.date(new Date(), 'yyyy-MM-dd HH:mm')
                    });

                    var path = getPathFromRecord(record),
                        body = self.project.pelicide.editor.editors[record.format.id].templates.article(record);

                    return self.project.pelicide.editor.close()
                        .then(function() { return API.set_content(path.path, path.name, body) })
                        .then(function () { return self.project.reload() })
                        .then(function () {
                            return self.project.pelicide.editor.open(self.project.getFile(path.path, path.name));
                        });
                })
                .catch(function (e) { if (e) Util.alert(e); });
        }
    };

    return ArticleContent;
});