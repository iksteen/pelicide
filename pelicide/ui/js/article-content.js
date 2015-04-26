define([
    'js/util',
    'jquery',
    'jquery_jsonrpc',
    'jquery_dateFormat'
], function(Util, jQuery) {

    function ArticleContent(project) {
        this.project = project;
    }

    ArticleContent.prototype = {
        _nodeId: null,

        init: function () {
            var self = this;

            this._nodeId = this.project.addContentType('Articles');

            var formats = [];
            jQuery.each(this.project.pelicide.editor.editors, function(f, e) {
                if (e.templates && e.templates.article)
                    formats.push(f);
            });

            $().w2form({
                name: 'create_article',
                style: 'border: 0px; background-color: transparent;',
                fields: [
                    {field: 'title', type: 'text', required: true, html: {caption: 'Title', attr: 'style="width: 250px"'}},
                    {field: 'category', type: 'combo', html: {caption: 'Category:', attr: 'style="width: 250px"'}},
                    {field: 'format', type: 'list', required: true, options: {items: formats}, html: {caption: 'Format', attr: 'style="width: 250px"'}},
                    {field: 'create_in', type: 'combo', html: {caption: 'Create in:', attr: 'style="width: 250px"'}}
                ],
                actions: {
                    Cancel: function () {
                        this.clear();
                        w2popup.close();
                    },
                    Create: function () {
                        if (this.validate(true).length == 0) {
                            w2popup.close();
                            self.createContent(this.record);
                            this.clear();
                        }
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
                return [this._nodeId, file.meta.category];
            }
        },

        create: function () {
            var self = this;

            jQuery.jsonRPC.request('get', {
                params: ['ARTICLE_PATHS'],
                success: function (result) {
                    var form = w2ui['create_article'];

                    form.record.format = form.get('format').options.items[0];
                    form.set('create_in', {options: {items: result.result}});
                    form.record.create_in = result.result[0];
                    form.set('category', {options: {items: self.project.categories()}});

                    w2popup.open({
                        title: 'Create article',
                        body: '<div id="create_article_form" style="width: 100%; height: 100%;"></div>',
                        style: 'padding: 15px 0px 0px 0px',
                        width: 500,
                        height: 300,
                        showMax: true,
                        onToggle: function (event) {
                            $(form.box).hide();
                            event.onComplete = function () {
                                $(form.box).show();
                                form.resize();
                            }
                        },
                        onOpen: function (event) {
                            event.onComplete = function () {
                                $('#w2ui-popup').find('#create_article_form').w2render(form);
                            }
                        }
                    });
                },
                error: Util.alert
            });
        },

        createContent: function (record) {
            jQuery.extend(record, {
                slug: Util.slugify(record.title),
                date: jQuery.format.date(new Date(), 'yyyy-MM-dd HH:mm')
            });

            var self = this,
                path = record.create_in.split('/'),
                filename = record.slug + '.' + record.format.id,
                body = this.project.pelicide.editor.editors[record.format.id].templates.article.body;

            if (path.length == 1 && path[0] == '')
                path = [];

            jQuery.each(record, function(k, v) {
                body = body.replace('{' + k + '}', v);
            });

            jQuery.jsonRPC.request('set_content', {
                params: [path, filename, body],
                success: function () {
                    self.project.reload(function () {
                        self.project.pelicide.editor.open(self.project.getFile(path, filename));
                    });
                },
                error: function (e) {
                    Util.alert(e);
                }
            });
        }
    };

    return ArticleContent;
});